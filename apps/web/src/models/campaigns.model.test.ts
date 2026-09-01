import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import {
  CampaignInUseError,
  CampaignNotFoundError,
  InvalidCampaignDatesError,
  createCampaign,
  deleteCampaign,
  getCampaign,
  isCampaignActiveNow,
  listCampaigns,
  updateCampaign,
} from './campaigns.model'

const ACTOR = 'eeeeeeee-1111-2222-3333-eeeeeeeeeeee'

describe('campaigns.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  it('create with defaults + audit', async () => {
    const c = await createCampaign({ name: '  Test  ' }, ACTOR)
    expect(c.name).toBe('Test')
    expect(c.active).toBe(false)
    expect(c.startsAt).toBeNull()
    expect(c.endsAt).toBeNull()
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'campaign', action: 'created' },
    })
    expect(audit.entityId).toBe(c.id)
  })

  it('create rejects invalid date range', async () => {
    await expect(
      createCampaign(
        { name: 'x', startsAt: '2027-01-01T00:00:00Z', endsAt: '2026-01-01T00:00:00Z' },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(InvalidCampaignDatesError)
  })

  it('list sorts active first', async () => {
    const a = await createCampaign({ name: 'A', active: true }, ACTOR)
    const b = await createCampaign({ name: 'B' }, ACTOR)
    const list = await listCampaigns()
    expect(list[0]?.id).toBe(a.id)
    expect(list[1]?.id).toBe(b.id)
  })

  it('update active toggles → audit action active_toggled', async () => {
    const c = await createCampaign({ name: 'X' }, ACTOR)
    await updateCampaign(c.id, { active: true }, ACTOR)
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'campaign', entityId: c.id, action: 'active_toggled' },
    })
    expect(audit).toBeTruthy()
  })

  it('update rejects endsAt before startsAt against current values', async () => {
    const c = await createCampaign(
      { name: 'X', startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-07-01T00:00:00Z' },
      ACTOR,
    )
    await expect(
      updateCampaign(c.id, { endsAt: '2026-05-01T00:00:00Z' }, ACTOR),
    ).rejects.toBeInstanceOf(InvalidCampaignDatesError)
  })

  it('get NotFound', async () => {
    await expect(getCampaign('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      CampaignNotFoundError,
    )
  })

  it('delete rejects if consent_requests reference the campaign', async () => {
    const c = await createCampaign({ name: 'X', active: true }, ACTOR)
    const template = await prisma.consentTemplate.create({
      data: { name: 't', subject: 's', bodyHtml: 'x', bodyText: 'x' },
    })
    const contact = await prisma.contact.create({
      data: {
        artistName: 'A',
        email: 'a@x.com',
        contactStatus: 'REVIEWED',
        emailStatus: 'FOUND',
        permission: 'ELIGIBLE',
      },
    })
    await prisma.consentRequest.create({
      data: {
        contactId: contact.id,
        campaignId: c.id,
        templateId: template.id,
        textVersion: 'snap',
        token: 'tok-abcdefghijklmnop',
      },
    })
    await expect(deleteCampaign(c.id, ACTOR)).rejects.toBeInstanceOf(CampaignInUseError)
  })

  describe('isCampaignActiveNow', () => {
    const base = { id: 'x', name: 'x', createdAt: new Date(), updatedAt: new Date(), maxSends: null }
    it('false if active=false', () => {
      expect(isCampaignActiveNow({ ...base, active: false, startsAt: null, endsAt: null })).toBe(false)
    })
    it('true if active and no dates', () => {
      expect(isCampaignActiveNow({ ...base, active: true, startsAt: null, endsAt: null })).toBe(true)
    })
    it('false if before startsAt', () => {
      const future = new Date(Date.now() + 60_000)
      expect(isCampaignActiveNow({ ...base, active: true, startsAt: future, endsAt: null })).toBe(false)
    })
    it('false if after endsAt', () => {
      const past = new Date(Date.now() - 60_000)
      expect(isCampaignActiveNow({ ...base, active: true, startsAt: null, endsAt: past })).toBe(false)
    })
  })
})
