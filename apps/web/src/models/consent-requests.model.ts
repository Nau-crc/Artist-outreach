import type { AppConfig, ConsentRequest, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/tokens'
import { logger } from '@/lib/logger'
import { writeAudit } from './audit.model'
import { dryRunEligibility } from './contacts.model'
import { autoPauseSending, getConfig } from './config.model'
import { isCampaignActiveNow } from './campaigns.model'
import { isSuppressed } from './suppressions.model'
import { sendEmail } from './email.model'
import { renderConsentEmail } from '@/services/consent-render'

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
  sent: number
  failed: number
  skipped: boolean
  reason?: string
  autoPaused?: boolean
  results: Array<{
    requestId: string
    outcome: 'SENT' | 'FAILED' | 'RATE_LIMITED' | 'AUTO_PAUSED'
    reason?: string
  }>
}

interface ProcessQueueOptions {
  maxBatch?: number
  now?: Date
}

const DEFAULT_MAX_BATCH = 20

/**
 * Worker real de la cola de consent_requests.
 *
 * Comportamiento:
 * - sending_enabled=false → skipped inmediato, sin tocar nada.
 * - sending_enabled=true:
 *   1. Chequea bounce rate. Si supera threshold, auto-pausa + aborta.
 *   2. Consulta límites daily/hourly ya alcanzados → si superados, no envía nada.
 *   3. Toma hasta maxBatch requests PENDING ordenadas por createdAt.
 *   4. Por cada una:
 *      a. Re-valida contact (ELIGIBLE, no suprimido, con email).
 *      b. Re-valida campaign (isActiveNow).
 *      c. Re-valida cooldown (por si otro batch mandó otra request recientemente).
 *      d. Parsea snapshot; si inválido → FAILED.
 *      e. Renderiza + envía via sendEmail(CONSENT_REQUEST).
 *      f. Marca SENT + sentAt + actualiza contact.consentStatus=REQUESTED.
 *      g. Respeta minIntervalSeconds entre envíos.
 * - Cualquier check que falle marca la request como FAILED con motivo; no
 *   consume rate limit (no se ha enviado nada).
 */
export async function processQueue(options: ProcessQueueOptions = {}): Promise<WorkerReport> {
  const maxBatch = options.maxBatch ?? DEFAULT_MAX_BATCH
  const now = options.now ?? new Date()

  const config = await getConfig()
  if (!config.sendingEnabled) {
    logger.info('[consent-queue] sending_enabled=false — worker no-op')
    return { processed: 0, sent: 0, failed: 0, skipped: true, reason: 'sending_disabled', results: [] }
  }

  // 1. Auto-pausa por bounce rate.
  const bounceRate = await computeBounceRate(config, now)
  if (bounceRate.exceeded) {
    await autoPauseSending(
      `bounce_rate=${bounceRate.ratio.toFixed(2)}% (>${config.bounceRateThresholdPct}%) sample=${bounceRate.sample}`,
    )
    logger.warn(bounceRate, '[consent-queue] auto-paused: bounce rate exceeded')
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      autoPaused: true,
      reason: 'auto_paused_bounce_rate',
      results: [],
    }
  }

  // 2. Rate limits agregados.
  const usage = await getSendUsage(now)
  const availableDaily =
    config.dailySendLimit > 0 ? Math.max(0, config.dailySendLimit - usage.last24h) : Infinity
  const availableHourly =
    config.hourlySendLimit > 0 ? Math.max(0, config.hourlySendLimit - usage.last1h) : Infinity
  const available = Math.min(availableDaily, availableHourly, maxBatch)
  if (available <= 0) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: `rate_limited (daily=${usage.last24h}/${config.dailySendLimit} hourly=${usage.last1h}/${config.hourlySendLimit})`,
      results: [],
    }
  }

  // 3. Toma batch.
  const pending = await prisma.consentRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: available,
    include: { contact: true, campaign: true },
  })

  const report: WorkerReport = {
    processed: pending.length,
    sent: 0,
    failed: 0,
    skipped: false,
    results: [],
  }

  let lastSentAt = usage.lastSentAt

  for (const req of pending) {
    // Espera minIntervalSeconds entre envíos.
    if (lastSentAt && config.minIntervalSeconds > 0) {
      const waitMs = lastSentAt.getTime() + config.minIntervalSeconds * 1000 - Date.now()
      if (waitMs > 0) await sleep(waitMs)
    }

    const outcome = await sendOne(req, config)
    report.results.push({ requestId: req.id, ...outcome })
    if (outcome.outcome === 'SENT') {
      report.sent++
      lastSentAt = new Date()
    } else {
      report.failed++
    }
  }

  return report
}

interface SendOneResult {
  outcome: 'SENT' | 'FAILED'
  reason?: string
}

async function sendOne(
  req: ConsentRequest & { contact: import('@prisma/client').Contact; campaign: import('@prisma/client').Campaign },
  config: AppConfig,
): Promise<SendOneResult> {
  // Re-valida al momento del envío. El estado puede haber cambiado desde
  // que se encoló.
  const contact = req.contact
  if (!contact.email) {
    return failRequest(req.id, 'no_email')
  }
  // Suppression primero — es la causa raíz de muchos otros bloqueos
  // (BLOCKED, SUPPRESSED); reportar 'suppressed' es más útil en audit.
  if (await isSuppressed(contact.email)) {
    return failRequest(req.id, 'suppressed')
  }
  if (contact.permission !== 'ELIGIBLE') {
    return failRequest(req.id, `permission_${contact.permission}`)
  }
  if (contact.consentStatus !== 'REQUESTED' && contact.consentStatus !== 'UNKNOWN') {
    return failRequest(req.id, `consent_status_${contact.consentStatus}`)
  }
  if (!isCampaignActiveNow(req.campaign)) {
    return failRequest(req.id, 'campaign_inactive')
  }

  const snapshot = parseTemplateSnapshot(req.textVersion)
  if (!snapshot) {
    return failRequest(req.id, 'snapshot_invalid')
  }

  try {
    const rendered = renderConsentEmail(snapshot, contact, req.token)
    const { providerMessageId } = await sendEmail({
      to: contact.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      purpose: 'CONSENT_REQUEST',
      contactId: contact.id,
      relatedId: req.id,
      textVersion: req.textVersion,
    })
    await prisma.$transaction(async (tx) => {
      await tx.consentRequest.update({
        where: { id: req.id },
        data: { status: 'SENT', sentAt: new Date() },
      })
      await tx.contact.update({
        where: { id: contact.id },
        data: { consentStatus: 'REQUESTED', lastActionAt: new Date() },
      })
      await writeAudit(
        {
          actorId: null,
          actorKind: 'SYSTEM',
          entityType: 'consent_request',
          entityId: req.id,
          action: 'sent',
          after: { providerMessageId, recipient: contact.email },
        },
        tx,
      )
    })
    return { outcome: 'SENT' }
  } catch (err) {
    const message = (err as Error).message
    logger.error({ err, requestId: req.id }, '[consent-queue] send failed')
    await prisma.$transaction(async (tx) => {
      await tx.consentRequest.update({
        where: { id: req.id },
        data: { status: 'FAILED' },
      })
      await writeAudit(
        {
          actorId: null,
          actorKind: 'SYSTEM',
          entityType: 'consent_request',
          entityId: req.id,
          action: 'send_failed',
          metadata: { error: message },
        },
        tx,
      )
    })
    return { outcome: 'FAILED', reason: message }
  }
}

async function failRequest(id: string, reason: string): Promise<SendOneResult> {
  await prisma.$transaction(async (tx) => {
    await tx.consentRequest.update({
      where: { id },
      data: { status: 'FAILED' },
    })
    await writeAudit(
      {
        actorId: null,
        actorKind: 'SYSTEM',
        entityType: 'consent_request',
        entityId: id,
        action: 'precheck_failed',
        metadata: { reason },
      },
      tx,
    )
  })
  return { outcome: 'FAILED', reason }
}

// ────────────────────────────────────────────────────────────────
// Rate limit + bounce rate helpers
// ────────────────────────────────────────────────────────────────

interface SendUsage {
  last24h: number
  last1h: number
  lastSentAt: Date | null
}

async function getSendUsage(now: Date): Promise<SendUsage> {
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const since1h = new Date(now.getTime() - 60 * 60 * 1000)
  const [last24h, last1h, latest] = await Promise.all([
    prisma.emailMessage.count({
      where: { purpose: 'CONSENT_REQUEST', status: 'SENT', sentAt: { gte: since24h } },
    }),
    prisma.emailMessage.count({
      where: { purpose: 'CONSENT_REQUEST', status: 'SENT', sentAt: { gte: since1h } },
    }),
    prisma.emailMessage.findFirst({
      where: { purpose: 'CONSENT_REQUEST', status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
  ])
  return { last24h, last1h, lastSentAt: latest?.sentAt ?? null }
}

export interface BounceRateInfo {
  sample: number
  bounces: number
  ratio: number
  exceeded: boolean
}

async function computeBounceRate(config: AppConfig, now: Date): Promise<BounceRateInfo> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sample = await prisma.emailMessage.count({
    where: { purpose: 'CONSENT_REQUEST', status: 'SENT', sentAt: { gte: since } },
  })
  if (sample < config.bounceRateMinSample) {
    return { sample, bounces: 0, ratio: 0, exceeded: false }
  }
  const bounces = await prisma.emailEvent.count({
    where: {
      eventType: { in: ['BOUNCED', 'COMPLAINED'] },
      message: {
        purpose: 'CONSENT_REQUEST',
        sentAt: { gte: since },
      },
    },
  })
  const ratio = (bounces / sample) * 100
  return {
    sample,
    bounces,
    ratio,
    exceeded: ratio > config.bounceRateThresholdPct,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

export interface TemplateSnapshot {
  version: number
  subject: string
  text: string
  html: string
}

function snapshotTextVersion(template: {
  version: number
  subject: string
  bodyText: string
  bodyHtml: string
}): string {
  // Snapshot completo del contenido del template al momento de encolar.
  // Congelado — editar el template después no altera este snapshot.
  // Sirve para: auditar qué se envió + rendering directo en el worker
  // sin depender del template actual.
  const snap: TemplateSnapshot = {
    version: template.version,
    subject: template.subject,
    text: template.bodyText,
    html: template.bodyHtml,
  }
  return JSON.stringify(snap)
}

export function parseTemplateSnapshot(textVersion: string): TemplateSnapshot | null {
  try {
    const parsed = JSON.parse(textVersion) as Partial<TemplateSnapshot>
    if (typeof parsed.version !== 'number' || typeof parsed.subject !== 'string') return null
    if (typeof parsed.text !== 'string' || typeof parsed.html !== 'string') return null
    return parsed as TemplateSnapshot
  } catch {
    return null
  }
}
