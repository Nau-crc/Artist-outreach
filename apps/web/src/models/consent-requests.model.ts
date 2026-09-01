import type { ConsentRequest, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/tokens'
import { logger } from '@/lib/logger'
import { writeAudit } from './audit.model'
import { dryRunEligibility } from './contacts.model'
import { getConfig } from './config.model'
import { isCampaignActiveNow } from './campaigns.model'
import { isSuppressed } from './suppressions.model'

const TOKEN_TTL_DAYS = 30

// ────────────────────────────────────────────────────────────────
// Types + errors
// ────────────────────────────────────────────────────────────────

export interface EnqueueInput {
  contactId: string
  campaignId: string
  templateId: string
}

export interface ListParams {
  status?: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
  contactId?: string
  campaignId?: string
  limit?: number
}

export interface SimulateInput {
  campaignId?: string
  templateId?: string
  limit: number
}

export interface SimulationResult {
  totalEvaluated: number
  eligible: number
  notEligible: number
  suppressed: number
  reasonsBreakdown: Record<string, number>
  sample: Array<{
    contactId: string
    artistName: string
    email: string | null
    eligible: boolean
    failingRules: string[]
  }>
}

export interface EnqueueResult {
  status: 'ENQUEUED' | 'NOT_ELIGIBLE'
  request?: ConsentRequest
  reasons?: string[]
}

export class ContactNotFoundError extends Error {
  constructor(id: string) {
    super(`Contact ${id} not found`)
    this.name = 'ContactNotFoundError'
  }
}

export class CampaignNotFoundError extends Error {
  constructor(id: string) {
    super(`Campaign ${id} not found`)
    this.name = 'CampaignNotFoundError'
  }
}

export class TemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Template ${id} not found`)
    this.name = 'TemplateNotFoundError'
  }
}

export class TemplateInactiveError extends Error {
  constructor() {
    super('Template is not active')
    this.name = 'TemplateInactiveError'
  }
}

export class DuplicateRequestError extends Error {
  constructor() {
    super('A pending consent request already exists for this contact in this campaign')
    this.name = 'DuplicateRequestError'
  }
}

export class CooldownActiveError extends Error {
  readonly retryAfterDays: number
  constructor(retryAfterDays: number) {
    super(`Contact was contacted recently; cooldown active for ${retryAfterDays} more days`)
    this.name = 'CooldownActiveError'
    this.retryAfterDays = retryAfterDays
  }
}

// ────────────────────────────────────────────────────────────────
// Enqueue
// ────────────────────────────────────────────────────────────────

/**
 * Encola una solicitud de consentimiento. Escribe consent_requests con
 * status=PENDING y actualiza contact.consentStatus=REQUESTED (desde UNKNOWN).
 *
 * NO envía nada. El envío outbound lo hará processQueue() en fase 6
 * únicamente si sending_enabled=true.
 *
 * Devuelve:
 *   - ENQUEUED con la request si todo pasa.
 *   - NOT_ELIGIBLE con lista de razones si el motor rechaza (no crea nada).
 */
export async function enqueueConsentRequest(
  input: EnqueueInput,
  actorId: string,
): Promise<EnqueueResult> {
  const [contact, campaign, template, config] = await Promise.all([
    prisma.contact.findUnique({ where: { id: input.contactId } }),
    prisma.campaign.findUnique({ where: { id: input.campaignId } }),
    prisma.consentTemplate.findUnique({ where: { id: input.templateId } }),
    getConfig(),
  ])

  if (!contact) throw new ContactNotFoundError(input.contactId)
  if (!campaign) throw new CampaignNotFoundError(input.campaignId)
  if (!template) throw new TemplateNotFoundError(input.templateId)
  if (!template.active) throw new TemplateInactiveError()

  const suppressed = contact.email ? await isSuppressed(contact.email) : false
  const eligibility = await dryRunEligibility(contact.id)

  const failing = eligibility.rules.filter((r) => !r.passed).map((r) => r.id)
  const failingReasons: string[] = [...failing]
  if (suppressed && !failingReasons.includes('not_suppressed')) {
    failingReasons.push('not_suppressed')
  }
  if (!isCampaignActiveNow(campaign)) failingReasons.push('campaign_inactive')

  // consentStatus check: solo enqueue si UNKNOWN — respeta cooldown para
  // WITHDRAWN o repeticiones de REQUESTED.
  if (contact.consentStatus !== 'UNKNOWN') {
    failingReasons.push(`consent_status:${contact.consentStatus}`)
  }

  // Cooldown por consent_request_cooldown_days.
  const cooldownFrom = new Date(Date.now() - config.consentRequestCooldownDays * 86_400_000)
  const recent = await prisma.consentRequest.findFirst({
    where: {
      contactId: input.contactId,
      OR: [
        { sentAt: { gte: cooldownFrom } },
        { createdAt: { gte: cooldownFrom } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
  if (recent) {
    const lastAt = recent.sentAt ?? recent.createdAt
    const daysSince = Math.floor((Date.now() - lastAt.getTime()) / 86_400_000)
    const retryAfter = Math.max(1, config.consentRequestCooldownDays - daysSince)
    throw new CooldownActiveError(retryAfter)
  }

  // Dedupe: no dos PENDING para el mismo contact + campaign.
  const dupe = await prisma.consentRequest.findFirst({
    where: {
      contactId: input.contactId,
      campaignId: input.campaignId,
      status: 'PENDING',
    },
  })
  if (dupe) throw new DuplicateRequestError()

  if (failingReasons.length > 0) {
    return { status: 'NOT_ELIGIBLE', reasons: failingReasons }
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.consentRequest.create({
      data: {
        contactId: input.contactId,
        campaignId: input.campaignId,
        templateId: input.templateId,
        textVersion: snapshotTextVersion(template),
        status: 'PENDING',
        token: generateToken(),
        tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000),
        eligibilitySnapshot: {
          rules: eligibility.rules,
          config: {
            sendingEnabled: config.sendingEnabled,
            campaignEnabled: config.campaignEnabled,
            dailySendLimit: config.dailySendLimit,
            hourlySendLimit: config.hourlySendLimit,
          },
          suppressed,
        } as unknown as Prisma.InputJsonValue,
        createdBy: actorId,
      },
    })

    await tx.contact.update({
      where: { id: input.contactId },
      data: { consentStatus: 'REQUESTED', lastActionAt: new Date() },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'consent_request',
        entityId: request.id,
        action: 'enqueued',
        after: {
          contactId: input.contactId,
          campaignId: input.campaignId,
          templateId: input.templateId,
          templateVersion: template.version,
        },
        metadata: { textVersion: request.textVersion.slice(0, 200) },
      },
      tx,
    )
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'contact',
        entityId: input.contactId,
        action: 'consent_requested',
        before: { consentStatus: contact.consentStatus },
        after: { consentStatus: 'REQUESTED' },
      },
      tx,
    )

    return { status: 'ENQUEUED' as const, request }
  })
}

// ────────────────────────────────────────────────────────────────
// Read + cancel
// ────────────────────────────────────────────────────────────────

export async function listConsentRequests(params: ListParams = {}) {
  const where: Prisma.ConsentRequestWhereInput = {}
  if (params.status) where.status = params.status
  if (params.contactId) where.contactId = params.contactId
  if (params.campaignId) where.campaignId = params.campaignId
  return prisma.consentRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(params.limit ?? 50, 200),
    include: {
      contact: { select: { id: true, artistName: true, email: true } },
      campaign: { select: { id: true, name: true, active: true } },
      template: { select: { id: true, name: true, version: true } },
    },
  })
}

export async function cancelConsentRequest(id: string, actorId: string): Promise<ConsentRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.consentRequest.findUnique({ where: { id } })
    if (!request) throw new Error('ConsentRequest not found')
    if (request.status !== 'PENDING') {
      throw new Error(`Cannot cancel request in status ${request.status}`)
    }
    const cancelled = await tx.consentRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'consent_request',
        entityId: id,
        action: 'cancelled',
        before: { status: 'PENDING' },
        after: { status: 'CANCELLED' },
      },
      tx,
    )
    return cancelled
  })
}

// ────────────────────────────────────────────────────────────────
// Simulate — dryRun del motor sobre N contactos, sin crear nada
// ────────────────────────────────────────────────────────────────

export async function simulateEligibility(input: SimulateInput): Promise<SimulationResult> {
  const limit = Math.min(input.limit, 200)
  // Candidatos razonables: REVIEWED + ELIGIBLE + consent UNKNOWN + con email.
  const candidates = await prisma.contact.findMany({
    where: {
      contactStatus: 'REVIEWED',
      permission: 'ELIGIBLE',
      consentStatus: 'UNKNOWN',
      email: { not: null },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, artistName: true, email: true },
  })

  let eligible = 0
  let notEligible = 0
  let suppressedCount = 0
  const reasonsBreakdown: Record<string, number> = {}
  const sample: SimulationResult['sample'] = []

  for (const c of candidates) {
    const report = await dryRunEligibility(c.id)
    // dryRunEligibility ya incluye la regla not_suppressed en report.rules.
    const failing = report.rules.filter((r) => !r.passed).map((r) => r.id)
    const wasSuppressed = failing.includes('not_suppressed')
    if (wasSuppressed) suppressedCount++
    if (report.eligible) {
      eligible++
    } else {
      notEligible++
      for (const r of failing) {
        reasonsBreakdown[r] = (reasonsBreakdown[r] ?? 0) + 1
      }
    }
    if (sample.length < 20) {
      sample.push({
        contactId: c.id,
        artistName: c.artistName,
        email: c.email,
        eligible: report.eligible,
        failingRules: failing,
      })
    }
  }

  return {
    totalEvaluated: candidates.length,
    eligible,
    notEligible,
    suppressed: suppressedCount,
    reasonsBreakdown,
    sample,
  }
}

// ────────────────────────────────────────────────────────────────
// Worker skeleton — respeta sending_enabled=false
// ────────────────────────────────────────────────────────────────

export interface WorkerReport {
  processed: number
  skipped: boolean
  reason?: string
  note?: string
}

/**
 * Worker de la cola de consent_requests.
 *
 * En fase 5 SIEMPRE se comporta como no-op:
 *   - sending_enabled=false → devuelve { skipped: true, reason: 'sending_disabled' }.
 *   - sending_enabled=true  → devuelve { skipped: true, reason: 'phase5_no_sending' }.
 *
 * El envío real lo implementa fase 6 con validación de motor completa,
 * rate limit, cron cadenciado y activación explícita del interruptor.
 * Nunca llama a sendEmail(purpose='CONSENT_REQUEST') desde aquí.
 */
export async function processQueue(): Promise<WorkerReport> {
  const config = await getConfig()
  if (!config.sendingEnabled) {
    logger.info('[consent-queue] sending_enabled=false — worker no-op')
    return { processed: 0, skipped: true, reason: 'sending_disabled' }
  }
  logger.warn(
    '[consent-queue] sending_enabled=true detected but phase 5 does not implement outbound. Nothing sent.',
  )
  return {
    processed: 0,
    skipped: true,
    reason: 'phase5_no_sending',
    note: 'Outbound send is implemented in fase 6 after explicit legal validation.',
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function snapshotTextVersion(template: {
  version: number
  subject: string
  bodyText: string
  bodyHtml: string
}): string {
  // Snapshot compacto suficiente para auditar exactamente qué texto se
  // usará al enviar (fase 6). Se congela en el momento de encolar y no
  // cambia aunque se edite el template después.
  return JSON.stringify({
    version: template.version,
    subject: template.subject,
    text: template.bodyText,
    htmlHash: hashString(template.bodyHtml),
  })
}

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h.toString(16)
}
