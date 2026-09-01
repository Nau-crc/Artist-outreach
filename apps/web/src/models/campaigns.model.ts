import type { Campaign, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit.model'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string
  active?: boolean
  startsAt?: string | null
  endsAt?: string | null
  maxSends?: number | null
}

export interface UpdateCampaignInput {
  name?: string
  active?: boolean
  startsAt?: string | null
  endsAt?: string | null
  maxSends?: number | null
}

export interface ListCampaignsParams {
  active?: boolean
}

// ────────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────────

export class CampaignNotFoundError extends Error {
  constructor(id: string) {
    super(`Campaign ${id} not found`)
    this.name = 'CampaignNotFoundError'
  }
}

export class CampaignInUseError extends Error {
  constructor() {
    super('Campaign has consent_requests and cannot be deleted')
    this.name = 'CampaignInUseError'
  }
}

export class InvalidCampaignDatesError extends Error {
  constructor() {
    super('endsAt must be after startsAt')
    this.name = 'InvalidCampaignDatesError'
  }
}

// ────────────────────────────────────────────────────────────────
// Read
// ────────────────────────────────────────────────────────────────

export async function listCampaigns(params: ListCampaignsParams = {}): Promise<Campaign[]> {
  return prisma.campaign.findMany({
    where: params.active !== undefined ? { active: params.active } : {},
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getCampaign(id: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id } })
  if (!campaign) throw new CampaignNotFoundError(id)
  return campaign
}

// ────────────────────────────────────────────────────────────────
// Write
// ────────────────────────────────────────────────────────────────

export async function createCampaign(
  input: CreateCampaignInput,
  actorId: string,
): Promise<Campaign> {
  validateDates(input.startsAt, input.endsAt)

  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name: input.name.trim(),
        active: input.active ?? false,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        maxSends: input.maxSends ?? null,
      },
    })
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'campaign',
        entityId: campaign.id,
        action: 'created',
        after: snapshot(campaign),
      },
      tx,
    )
    return campaign
  })
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignInput,
  actorId: string,
): Promise<Campaign> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.campaign.findUnique({ where: { id } })
    if (!before) throw new CampaignNotFoundError(id)

    const nextStarts = patch.startsAt !== undefined
      ? patch.startsAt ? new Date(patch.startsAt) : null
      : before.startsAt
    const nextEnds = patch.endsAt !== undefined
      ? patch.endsAt ? new Date(patch.endsAt) : null
      : before.endsAt
    if (nextStarts && nextEnds && nextEnds <= nextStarts) {
      throw new InvalidCampaignDatesError()
    }

    const data: Prisma.CampaignUpdateInput = {}
    if (patch.name !== undefined) data.name = patch.name.trim()
    if (patch.active !== undefined) data.active = patch.active
    if (patch.startsAt !== undefined) data.startsAt = nextStarts
    if (patch.endsAt !== undefined) data.endsAt = nextEnds
    if (patch.maxSends !== undefined) data.maxSends = patch.maxSends

    if (Object.keys(data).length === 0) return before

    const after = await tx.campaign.update({ where: { id }, data })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'campaign',
        entityId: id,
        action: before.active !== after.active ? 'active_toggled' : 'updated',
        before: snapshot(before),
        after: snapshot(after),
      },
      tx,
    )

    return after
  })
}

export async function deleteCampaign(id: string, actorId: string): Promise<void> {
  const usage = await prisma.consentRequest.count({ where: { campaignId: id } })
  if (usage > 0) throw new CampaignInUseError()

  await prisma.$transaction(async (tx) => {
    const before = await tx.campaign.findUnique({ where: { id } })
    if (!before) throw new CampaignNotFoundError(id)
    await tx.campaign.delete({ where: { id } })
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'campaign',
        entityId: id,
        action: 'deleted',
        before: snapshot(before),
      },
      tx,
    )
  })
}

// ────────────────────────────────────────────────────────────────
// Runtime helpers
// ────────────────────────────────────────────────────────────────

export function isCampaignActiveNow(c: Campaign, now = new Date()): boolean {
  if (!c.active) return false
  if (c.startsAt && c.startsAt > now) return false
  if (c.endsAt && c.endsAt < now) return false
  return true
}

function validateDates(startsAt?: string | null, endsAt?: string | null): void {
  if (!startsAt || !endsAt) return
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new InvalidCampaignDatesError()
  }
}

function snapshot(c: Campaign) {
  return {
    name: c.name,
    active: c.active,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    maxSends: c.maxSends,
  }
}
