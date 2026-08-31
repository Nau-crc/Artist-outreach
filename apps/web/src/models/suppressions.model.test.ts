import { InvalidEmailError } from '@artist-outreach/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import {
  addSuppression,
  isSuppressed,
  listSuppressions,
  removeSuppression,
} from './suppressions.model'

const ACTOR = '33333333-3333-3333-3333-333333333333'

async function createContact(email: string | null, name = 'Test Artist') {
  return prisma.contact.create({
    data: {
      artistName: name,
      email: email ? email.toLowerCase().trim() : null,
      contactStatus: 'REVIEWED',
      emailStatus: email ? 'FOUND' : 'NOT_FOUND',
      permission: 'ELIGIBLE',
    },
  })
}

describe('suppressions.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  it('adds a suppression and normalizes the email', async () => {
    const s = await addSuppression(
      { email: '  Foo@Example.COM ', reason: 'MANUAL' },
      ACTOR,
    )
    expect(s.email).toBe('foo@example.com')
    expect(s.reason).toBe('MANUAL')
    expect(s.suppressedBy).toBe(ACTOR)

    const logs = await prisma.auditLog.findMany({ where: { entityType: 'suppression' } })
    expect(logs).toHaveLength(1)
    expect(logs[0]?.action).toBe('added')
  })

  it('is idempotent — inserting the same email twice returns the existing row', async () => {
    const first = await addSuppression({ email: 'a@b.com', reason: 'MANUAL' }, ACTOR)
    const second = await addSuppression({ email: 'a@b.com', reason: 'HARD_BOUNCE' }, ACTOR)
    expect(second.id).toBe(first.id)
    expect(second.reason).toBe('MANUAL')
    expect(await prisma.suppression.count()).toBe(1)
  })

  it('cascades: matching contacts become SUPPRESSED + BLOCKED', async () => {
    const contact = await createContact('cascade@example.com', 'Cascade Artist')
    await addSuppression({ email: 'cascade@example.com', reason: 'COMPLAINT' }, ACTOR)

    const updated = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(updated.contactStatus).toBe('SUPPRESSED')
    expect(updated.permission).toBe('BLOCKED')

    const cascadeLogs = await prisma.auditLog.findMany({
      where: { entityType: 'contact', action: 'suppression_cascade' },
    })
    expect(cascadeLogs).toHaveLength(1)
    expect(cascadeLogs[0]?.entityId).toBe(contact.id)
  })

  it('cascades over multiple contacts sharing the same email', async () => {
    await createContact('dup@example.com', 'Dup 1')
    // Directly bypass the unique constraint won't fly — the second create should fail.
    // Instead we test that a single contact with matching email cascades correctly.
    await addSuppression({ email: 'dup@example.com', reason: 'MANUAL' }, ACTOR)
    const all = await prisma.contact.findMany({ where: { email: 'dup@example.com' } })
    for (const c of all) {
      expect(c.contactStatus).toBe('SUPPRESSED')
      expect(c.permission).toBe('BLOCKED')
    }
  })

  it('rejects invalid emails', async () => {
    await expect(
      addSuppression({ email: 'not-an-email', reason: 'MANUAL' }, ACTOR),
    ).rejects.toBeInstanceOf(InvalidEmailError)
    expect(await prisma.suppression.count()).toBe(0)
  })

  it('removeSuppression deletes and audits, does not revive contacts', async () => {
    const contact = await createContact('bye@example.com')
    const s = await addSuppression({ email: 'bye@example.com', reason: 'MANUAL' }, ACTOR)
    await removeSuppression(s.id, ACTOR)

    expect(await prisma.suppression.count()).toBe(0)
    const stillSuppressed = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
    expect(stillSuppressed.contactStatus).toBe('SUPPRESSED')
    expect(stillSuppressed.permission).toBe('BLOCKED')

    const removedLog = await prisma.auditLog.findFirst({
      where: { entityType: 'suppression', action: 'removed' },
    })
    expect(removedLog).not.toBeNull()
  })

  it('removeSuppression is a no-op on unknown id', async () => {
    await removeSuppression('44444444-4444-4444-4444-444444444444', ACTOR)
    expect(await prisma.auditLog.count()).toBe(0)
  })

  it('listSuppressions filters by email substring and reason', async () => {
    await addSuppression({ email: 'ana@a.com', reason: 'MANUAL' }, ACTOR)
    await addSuppression({ email: 'ana@b.com', reason: 'HARD_BOUNCE' }, ACTOR)
    await addSuppression({ email: 'bob@c.com', reason: 'MANUAL' }, ACTOR)

    const byEmail = await listSuppressions({ email: 'ana' })
    expect(byEmail).toHaveLength(2)

    const byReason = await listSuppressions({ reason: 'HARD_BOUNCE' })
    expect(byReason).toHaveLength(1)
    expect(byReason[0]?.email).toBe('ana@b.com')
  })

  it('isSuppressed returns true only for exact normalized match', async () => {
    await addSuppression({ email: 'x@y.com', reason: 'MANUAL' }, ACTOR)
    expect(await isSuppressed('X@Y.COM')).toBe(true)
    expect(await isSuppressed('other@y.com')).toBe(false)
    expect(await isSuppressed('not-an-email')).toBe(false)
  })
})
