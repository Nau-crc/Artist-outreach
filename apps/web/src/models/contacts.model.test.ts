import { InvalidEmailError } from '@artist-outreach/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import { addSuppression } from './suppressions.model'
import {
  ContactNotFoundError,
  DuplicateContactError,
  InvalidTransitionError,
  SuppressForbiddenError,
  createContact,
  dryRunEligibility,
  getContact,
  listContacts,
  reviewContact,
  updateContact,
} from './contacts.model'

const ACTOR = '77777777-7777-7777-7777-777777777777'

describe('contacts.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ────────────────────────────────────────────────────────────────
  // create
  // ────────────────────────────────────────────────────────────────

  describe('createContact', () => {
    it('creates a contact with normalized email and REVIEW_REQUIRED status', async () => {
      const c = await createContact(
        { artistName: '  Ana Luz  ', email: 'Ana@Example.COM', country: 'es' },
        ACTOR,
      )
      expect(c.artistName).toBe('Ana Luz')
      expect(c.email).toBe('ana@example.com')
      expect(c.country).toBe('ES')
      expect(c.contactStatus).toBe('REVIEW_REQUIRED')
      expect(c.emailStatus).toBe('FOUND')
      expect(c.permission).toBe('NOT_REVIEWED')

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'contact', action: 'created' },
      })
      expect(log.entityId).toBe(c.id)
      expect(log.actorId).toBe(ACTOR)
    })

    it('creates without email — status DISCOVERED-ish (REVIEW_REQUIRED anyway)', async () => {
      const c = await createContact({ artistName: 'Sin Email' }, ACTOR)
      expect(c.email).toBeNull()
      expect(c.emailStatus).toBe('NOT_FOUND')
      expect(c.contactStatus).toBe('REVIEW_REQUIRED')
    })

    it('rejects duplicate email', async () => {
      await createContact({ artistName: 'A', email: 'x@y.com' }, ACTOR)
      await expect(
        createContact({ artistName: 'B', email: 'X@Y.com' }, ACTOR),
      ).rejects.toBeInstanceOf(DuplicateContactError)
    })

    it('rejects invalid email', async () => {
      await expect(
        createContact({ artistName: 'A', email: 'not-an-email' }, ACTOR),
      ).rejects.toBeInstanceOf(InvalidEmailError)
    })

    it('auto-suppresses if the email is on the suppression list', async () => {
      await addSuppression({ email: 'banned@example.com', reason: 'MANUAL' }, ACTOR)
      const c = await createContact(
        { artistName: 'Banned', email: 'banned@example.com' },
        ACTOR,
      )
      expect(c.contactStatus).toBe('SUPPRESSED')
      expect(c.permission).toBe('BLOCKED')
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'contact', action: 'created' },
      })
      const meta = log.metadata as { autoSuppressed?: boolean } | null
      expect(meta?.autoSuppressed).toBe(true)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // list / get
  // ────────────────────────────────────────────────────────────────

  describe('listContacts / getContact', () => {
    beforeEach(async () => {
      await createContact({ artistName: 'Ana', email: 'ana@a.com', country: 'ES', discipline: 'música' }, ACTOR)
      await createContact({ artistName: 'Bob', email: 'bob@b.com', country: 'MX', discipline: 'teatro' }, ACTOR)
      await createContact({ artistName: 'Clara', email: 'clara@c.com', country: 'ES', discipline: 'danza' }, ACTOR)
    })

    it('lists all contacts (default)', async () => {
      const all = await listContacts()
      expect(all).toHaveLength(3)
    })

    it('filters by country and discipline', async () => {
      const es = await listContacts({ country: 'ES' })
      expect(es).toHaveLength(2)
      const dance = await listContacts({ discipline: 'danza' })
      expect(dance).toHaveLength(1)
      expect(dance[0]?.artistName).toBe('Clara')
    })

    it('searches by artistName case-insensitive', async () => {
      const found = await listContacts({ search: 'ana' })
      expect(found).toHaveLength(1)
    })

    it('paginates by cursor', async () => {
      const first = await listContacts({ limit: 2 })
      expect(first).toHaveLength(2)
      const second = await listContacts({ limit: 2, cursor: first[first.length - 1]!.id })
      expect(second).toHaveLength(1)
      expect(second[0]?.id).not.toBe(first[0]?.id)
    })

    it('getContact returns 404 for missing id', async () => {
      await expect(getContact('99999999-9999-9999-9999-999999999999')).rejects.toBeInstanceOf(
        ContactNotFoundError,
      )
    })

    it('getContact includes contactSources', async () => {
      const created = await listContacts({ search: 'ana' })
      const contact = await getContact(created[0]!.id)
      // No contact_sources para contactos creados manualmente en tests.
      expect(contact.contactSources).toEqual([])
    })
  })

  // ────────────────────────────────────────────────────────────────
  // update
  // ────────────────────────────────────────────────────────────────

  describe('updateContact', () => {
    it('updates fields and writes a diff audit log', async () => {
      const c = await createContact({ artistName: 'Old Name', email: 'old@a.com' }, ACTOR)
      const updated = await updateContact(
        c.id,
        { artistName: 'New Name', city: 'Madrid' },
        ACTOR,
      )
      expect(updated.artistName).toBe('New Name')
      expect(updated.city).toBe('Madrid')

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'contact', action: 'updated' },
      })
      const before = log.before as Record<string, unknown>
      const after = log.after as Record<string, unknown>
      expect(before.artistName).toBe('Old Name')
      expect(after.artistName).toBe('New Name')
      expect(after.city).toBe('Madrid')
    })

    it('no-op patch does not write audit', async () => {
      const c = await createContact({ artistName: 'A' }, ACTOR)
      await prisma.auditLog.deleteMany()
      await updateContact(c.id, {}, ACTOR)
      expect(await prisma.auditLog.count()).toBe(0)
    })

    it('changing email checks dedupe', async () => {
      const a = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      await createContact({ artistName: 'B', email: 'b@x.com' }, ACTOR)
      await expect(
        updateContact(a.id, { email: 'b@x.com' }, ACTOR),
      ).rejects.toBeInstanceOf(DuplicateContactError)
    })

    it('changing email to a suppressed one auto-suppresses', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      await addSuppression({ email: 'banned@x.com', reason: 'MANUAL' }, ACTOR)
      const updated = await updateContact(c.id, { email: 'banned@x.com' }, ACTOR)
      expect(updated.contactStatus).toBe('SUPPRESSED')
      expect(updated.permission).toBe('BLOCKED')
    })

    it('sets email to null clears emailStatus', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      const updated = await updateContact(c.id, { email: null }, ACTOR)
      expect(updated.email).toBeNull()
      expect(updated.emailStatus).toBe('NOT_FOUND')
    })

    it('returns 404 for missing contact', async () => {
      await expect(
        updateContact('99999999-9999-9999-9999-999999999999', { artistName: 'X' }, ACTOR),
      ).rejects.toBeInstanceOf(ContactNotFoundError)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // review
  // ────────────────────────────────────────────────────────────────

  describe('reviewContact', () => {
    it('APPROVE from REVIEW_REQUIRED → REVIEWED + ELIGIBLE if rules pass', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      const reviewed = await reviewContact(c.id, { kind: 'APPROVE' }, ACTOR)
      expect(reviewed.contactStatus).toBe('REVIEWED')
      expect(reviewed.permission).toBe('ELIGIBLE')
      expect(reviewed.reviewedBy).toBe(ACTOR)
      expect(reviewed.reviewedAt).not.toBeNull()

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'contact', action: 'approved' },
      })
      expect(log.entityId).toBe(c.id)
    })

    it('APPROVE without email → REVIEWED but NOT_ELIGIBLE', async () => {
      const c = await createContact({ artistName: 'NoEmail' }, ACTOR)
      const reviewed = await reviewContact(c.id, { kind: 'APPROVE' }, ACTOR)
      expect(reviewed.contactStatus).toBe('REVIEWED')
      expect(reviewed.permission).toBe('NOT_ELIGIBLE')
    })

    it('APPROVE fails from DISCARDED (invalid transition)', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      await reviewContact(c.id, { kind: 'DISCARD' }, ACTOR)
      await expect(reviewContact(c.id, { kind: 'APPROVE' }, ACTOR)).rejects.toBeInstanceOf(
        InvalidTransitionError,
      )
    })

    it('DISCARD from REVIEW_REQUIRED', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      const out = await reviewContact(c.id, { kind: 'DISCARD', reason: 'off-topic' }, ACTOR)
      expect(out.contactStatus).toBe('DISCARDED')
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'contact', action: 'discarded' },
      })
      expect((log.metadata as { reason?: string } | null)?.reason).toBe('off-topic')
    })

    it('SUPPRESS with email delegates cascade to suppressions', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      const out = await reviewContact(c.id, { kind: 'SUPPRESS', reason: 'requested' }, ACTOR)
      expect(out.contactStatus).toBe('SUPPRESSED')
      expect(out.permission).toBe('BLOCKED')
      const supp = await prisma.suppression.findUniqueOrThrow({ where: { email: 'a@x.com' } })
      expect(supp.reason).toBe('MANUAL')
    })

    it('SUPPRESS without email → error', async () => {
      const c = await createContact({ artistName: 'NoEmail' }, ACTOR)
      await expect(reviewContact(c.id, { kind: 'SUPPRESS' }, ACTOR)).rejects.toBeInstanceOf(
        SuppressForbiddenError,
      )
    })
  })

  // ────────────────────────────────────────────────────────────────
  // dry-run eligibility
  // ────────────────────────────────────────────────────────────────

  describe('dryRunEligibility', () => {
    it('reports non-eligible for REVIEW_REQUIRED (permission != ELIGIBLE)', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      const report = await dryRunEligibility(c.id)
      expect(report.eligible).toBe(false)
      const permissionRule = report.rules.find((r) => r.id === 'permission_eligible')
      expect(permissionRule?.passed).toBe(false)
    })

    it('reports eligible for REVIEWED + ELIGIBLE + UNKNOWN consent', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      await reviewContact(c.id, { kind: 'APPROVE' }, ACTOR)
      const report = await dryRunEligibility(c.id)
      expect(report.eligible).toBe(true)
      expect(report.rules.every((r) => r.passed)).toBe(true)
    })

    it('reports non-eligible if suppressed', async () => {
      const c = await createContact({ artistName: 'A', email: 'a@x.com' }, ACTOR)
      await reviewContact(c.id, { kind: 'APPROVE' }, ACTOR)
      await addSuppression({ email: 'a@x.com', reason: 'MANUAL' }, ACTOR)
      const report = await dryRunEligibility(c.id)
      expect(report.eligible).toBe(false)
      const suppRule = report.rules.find((r) => r.id === 'not_suppressed')
      expect(suppRule?.passed).toBe(false)
    })

    it('reports non-eligible if email is missing', async () => {
      const c = await createContact({ artistName: 'A' }, ACTOR)
      const report = await dryRunEligibility(c.id)
      expect(report.eligible).toBe(false)
      const emailRule = report.rules.find((r) => r.id === 'email_present')
      expect(emailRule?.passed).toBe(false)
    })
  })
})
