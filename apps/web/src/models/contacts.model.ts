import type { Contact, ContactStatus, Permission, Prisma } from '@prisma/client'
import {
  CONTACT_STATUS_TRANSITIONS,
  canTransition,
  Email,
  InvalidEmailError,
} from '@artist-outreach/shared'
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit.model'
import { isSuppressed, addSuppression } from './suppressions.model'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface CreateContactInput {
  artistName: string
  email?: string
  website?: string
  discipline?: string
  country?: string
  city?: string
  language?: string
  notes?: string
}

export interface UpdateContactInput {
  artistName?: string
  email?: string | null
  website?: string | null
  discipline?: string | null
  country?: string | null
  city?: string | null
  language?: string | null
  notes?: string | null
}

export interface ListContactsParams {
  contactStatus?: ContactStatus
  permission?: Permission
  country?: string
  discipline?: string
  search?: string
  limit?: number
  cursor?: string
}

export type ReviewDecision =
  | { kind: 'APPROVE' }
  | { kind: 'DISCARD'; reason?: string }
  | { kind: 'SUPPRESS'; reason?: string }

export interface EligibilityReport {
  eligible: boolean
  rules: EligibilityRule[]
}

export interface EligibilityRule {
  id: string
  description: string
  passed: boolean
  detail?: string
}

// ────────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────────

export class ContactNotFoundError extends Error {
  constructor(id: string) {
    super(`Contact ${id} not found`)
    this.name = 'ContactNotFoundError'
  }
}

export class DuplicateContactError extends Error {
  readonly existingId: string
  constructor(existingId: string) {
    super(`Contact with this email already exists (${existingId})`)
    this.name = 'DuplicateContactError'
    this.existingId = existingId
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: ContactStatus, to: ContactStatus) {
    super(`Invalid contact_status transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

export class SuppressForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SuppressForbiddenError'
  }
}

// ────────────────────────────────────────────────────────────────
// Read
// ────────────────────────────────────────────────────────────────

export async function listContacts(params: ListContactsParams = {}) {
  const where: Prisma.ContactWhereInput = {}
  if (params.contactStatus) where.contactStatus = params.contactStatus
  if (params.permission) where.permission = params.permission
  if (params.country) where.country = params.country.toUpperCase()
  if (params.discipline) where.discipline = params.discipline
  if (params.search) {
    const s = params.search.trim()
    where.OR = [
      { artistName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s.toLowerCase() } },
      { website: { contains: s, mode: 'insensitive' } },
      { city: { contains: s, mode: 'insensitive' } },
    ]
  }

  const limit = Math.min(params.limit ?? 50, 200)
  return prisma.contact.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  })
}

export async function getContact(id: string) {
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      contactSources: {
        include: { source: { select: { slug: true, name: true } } },
        orderBy: { discoveredAt: 'desc' },
      },
    },
  })
  if (!contact) throw new ContactNotFoundError(id)
  return contact
}

// ────────────────────────────────────────────────────────────────
// Create
// ────────────────────────────────────────────────────────────────

export async function createContact(
  input: CreateContactInput,
  actorId: string,
): Promise<Contact> {
  const normalizedEmail = normalizeEmail(input.email)

  return prisma.$transaction(async (tx) => {
    if (normalizedEmail) {
      const existing = await tx.contact.findUnique({ where: { email: normalizedEmail } })
      if (existing) throw new DuplicateContactError(existing.id)
    }

    const suppressed = normalizedEmail ? await isSuppressed(normalizedEmail) : false

    const contact = await tx.contact.create({
      data: {
        artistName: input.artistName.trim(),
        email: normalizedEmail,
        website: input.website?.trim() ?? null,
        discipline: input.discipline?.trim() ?? null,
        country: input.country ? input.country.toUpperCase() : null,
        city: input.city?.trim() ?? null,
        language: input.language?.trim() ?? null,
        notes: input.notes ?? null,
        emailStatus: normalizedEmail ? 'FOUND' : 'NOT_FOUND',
        contactStatus: suppressed ? 'SUPPRESSED' : 'REVIEW_REQUIRED',
        permission: suppressed ? 'BLOCKED' : 'NOT_REVIEWED',
      },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'contact',
        entityId: contact.id,
        action: 'created',
        after: contactSnapshot(contact),
        metadata: suppressed ? { autoSuppressed: true } : undefined,
      },
      tx,
    )

    return contact
  })
}

// ────────────────────────────────────────────────────────────────
// Update (editable fields only — no direct state changes)
// ────────────────────────────────────────────────────────────────

export async function updateContact(
  id: string,
  patch: UpdateContactInput,
  actorId: string,
): Promise<Contact> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.contact.findUnique({ where: { id } })
    if (!before) throw new ContactNotFoundError(id)

    const data: Prisma.ContactUpdateInput = {}
    let suppressed = false

    if (patch.email !== undefined) {
      const normalized = normalizeEmail(patch.email)
      if (normalized !== before.email) {
        if (normalized) {
          const dupe = await tx.contact.findUnique({ where: { email: normalized } })
          if (dupe && dupe.id !== id) throw new DuplicateContactError(dupe.id)
          suppressed = await isSuppressed(normalized)
        }
        data.email = normalized
        data.emailStatus = normalized ? 'FOUND' : 'NOT_FOUND'
        if (suppressed) {
          data.contactStatus = 'SUPPRESSED'
          data.permission = 'BLOCKED'
        }
      }
    }

    assignIfDefined(data, patch, 'artistName', (v) => v.trim())
    assignIfDefined(data, patch, 'website')
    assignIfDefined(data, patch, 'discipline')
    assignIfDefined(data, patch, 'city')
    assignIfDefined(data, patch, 'language')
    assignIfDefined(data, patch, 'notes')
    if (patch.country !== undefined) {
      data.country = patch.country ? patch.country.toUpperCase() : null
    }

    if (Object.keys(data).length === 0) return before

    data.lastActionAt = new Date()

    const after = await tx.contact.update({ where: { id }, data })

    const diff = computeDiff(before, after)
    if (Object.keys(diff.before).length > 0) {
      await writeAudit(
        {
          actorId,
          actorKind: 'USER',
          entityType: 'contact',
          entityId: id,
          action: 'updated',
          before: diff.before,
          after: diff.after,
          metadata: suppressed ? { autoSuppressed: true } : undefined,
        },
        tx,
      )
    }

    return after
  })
}

// ────────────────────────────────────────────────────────────────
// Review — the human decision path
// ────────────────────────────────────────────────────────────────

export async function reviewContact(
  id: string,
  decision: ReviewDecision,
  actorId: string,
): Promise<Contact> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.contact.findUnique({ where: { id } })
    if (!before) throw new ContactNotFoundError(id)

    if (decision.kind === 'APPROVE') {
      requireTransition(before.contactStatus, 'REVIEWED')
      const report = evaluateEligibilityRulesSync({
        email: before.email,
        emailStatus: before.emailStatus,
        contactStatus: 'REVIEWED',
        consentStatus: before.consentStatus,
      })
      const suppressed = before.email ? await isSuppressed(before.email) : false
      const eligible = report.eligible && !suppressed
      const after = await tx.contact.update({
        where: { id },
        data: {
          contactStatus: 'REVIEWED',
          permission: eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
          reviewedAt: new Date(),
          reviewedBy: actorId,
          lastActionAt: new Date(),
        },
      })
      await writeAudit(
        {
          actorId,
          actorKind: 'USER',
          entityType: 'contact',
          entityId: id,
          action: 'approved',
          before: { contactStatus: before.contactStatus, permission: before.permission },
          after: { contactStatus: after.contactStatus, permission: after.permission },
          metadata: { eligibility: report.rules, suppressed },
        },
        tx,
      )
      return after
    }

    if (decision.kind === 'DISCARD') {
      requireTransition(before.contactStatus, 'DISCARDED')
      const after = await tx.contact.update({
        where: { id },
        data: {
          contactStatus: 'DISCARDED',
          reviewedAt: new Date(),
          reviewedBy: actorId,
          lastActionAt: new Date(),
        },
      })
      await writeAudit(
        {
          actorId,
          actorKind: 'USER',
          entityType: 'contact',
          entityId: id,
          action: 'discarded',
          before: { contactStatus: before.contactStatus },
          after: { contactStatus: 'DISCARDED' },
          metadata: decision.reason ? { reason: decision.reason } : undefined,
        },
        tx,
      )
      return after
    }

    // SUPPRESS — requires email; delegates cascade to suppressions model.
    if (!before.email) {
      throw new SuppressForbiddenError('Cannot suppress a contact without an email')
    }
    // Note: addSuppression runs in its own $transaction. Called AFTER our
    // read is committed by nesting outside — but here we're already inside a
    // tx. Prisma requires nested tx via interactive: we bail out and call
    // addSuppression separately below.
    throw new SuppressOutsideTxSignal(before.email, decision.reason)
  }).catch(async (err) => {
    if (err instanceof SuppressOutsideTxSignal) {
      await addSuppression(
        { email: err.email, reason: 'MANUAL', notes: err.reason ?? undefined },
        actorId,
      )
      const after = await prisma.contact.findUniqueOrThrow({ where: { id } })
      return after
    }
    throw err
  })
}

class SuppressOutsideTxSignal extends Error {
  constructor(
    readonly email: string,
    readonly reason: string | undefined,
  ) {
    super('SuppressOutsideTxSignal')
    this.name = 'SuppressOutsideTxSignal'
  }
}

// ────────────────────────────────────────────────────────────────
// Eligibility — dry-run
// ────────────────────────────────────────────────────────────────

export async function dryRunEligibility(id: string): Promise<EligibilityReport> {
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) throw new ContactNotFoundError(id)

  const rules = evaluateEligibilityRulesSync({
    email: contact.email,
    emailStatus: contact.emailStatus,
    contactStatus: contact.contactStatus,
    consentStatus: contact.consentStatus,
    permission: contact.permission,
  }).rules

  const suppressed = contact.email ? await isSuppressed(contact.email) : false
  rules.push({
    id: 'not_suppressed',
    description: 'El email no está en la lista de supresiones',
    passed: !suppressed,
    detail: suppressed ? 'El email está suprimido' : undefined,
  })

  return {
    eligible: rules.every((r) => r.passed),
    rules,
  }
}

interface RuleContext {
  email: string | null
  emailStatus: string
  contactStatus: ContactStatus
  consentStatus: string
  permission?: Permission
}

function evaluateEligibilityRulesSync(ctx: RuleContext): EligibilityReport {
  const rules: EligibilityRule[] = []

  rules.push({
    id: 'email_present',
    description: 'El contacto tiene email',
    passed: ctx.email !== null,
    detail: ctx.email === null ? 'Email ausente' : undefined,
  })

  if (ctx.email !== null) {
    const valid = Email.safeParse(ctx.email).success
    rules.push({
      id: 'email_valid',
      description: 'El email es sintácticamente válido',
      passed: valid,
    })
  }

  rules.push({
    id: 'email_status_ok',
    description: 'El estado del email no es INVALID ni BOUNCED',
    passed: ctx.emailStatus !== 'INVALID' && ctx.emailStatus !== 'BOUNCED',
    detail: ctx.emailStatus,
  })

  rules.push({
    id: 'consent_unknown',
    description: 'El consentimiento aún no ha sido solicitado (UNKNOWN)',
    passed: ctx.consentStatus === 'UNKNOWN',
    detail: ctx.consentStatus,
  })

  if (ctx.permission !== undefined) {
    rules.push({
      id: 'permission_eligible',
      description: 'El contacto ha sido marcado como ELIGIBLE tras revisión',
      passed: ctx.permission === 'ELIGIBLE',
      detail: ctx.permission,
    })
  }

  return {
    eligible: rules.every((r) => r.passed),
    rules,
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function normalizeEmail(input: string | null | undefined): string | null {
  if (input === undefined || input === null) return null
  const trimmed = input.trim()
  if (trimmed === '') return null
  const parsed = Email.safeParse(trimmed)
  if (!parsed.success) throw new InvalidEmailError(trimmed)
  return parsed.email.value
}

function requireTransition(from: ContactStatus, to: ContactStatus) {
  if (!canTransition(CONTACT_STATUS_TRANSITIONS, from, to)) {
    throw new InvalidTransitionError(from, to)
  }
}

function assignIfDefined<
  K extends 'artistName' | 'website' | 'discipline' | 'city' | 'language' | 'notes',
>(
  data: Prisma.ContactUpdateInput,
  patch: UpdateContactInput,
  key: K,
  transform: (v: string) => string = (v) => v,
): void {
  const value = patch[key]
  if (value === undefined) return
  if (value === null) {
    ;(data as Record<string, unknown>)[key] = null
  } else {
    ;(data as Record<string, unknown>)[key] = transform(value)
  }
}

function contactSnapshot(c: Contact) {
  return {
    artistName: c.artistName,
    email: c.email,
    website: c.website,
    discipline: c.discipline,
    country: c.country,
    city: c.city,
    contactStatus: c.contactStatus,
    emailStatus: c.emailStatus,
    consentStatus: c.consentStatus,
    permission: c.permission,
  }
}

function computeDiff(before: Contact, after: Contact) {
  const tracked: Array<keyof Contact> = [
    'artistName',
    'email',
    'website',
    'discipline',
    'country',
    'city',
    'language',
    'notes',
    'contactStatus',
    'emailStatus',
    'permission',
  ]
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  for (const key of tracked) {
    if (before[key] !== after[key]) {
      b[key as string] = before[key]
      a[key as string] = after[key]
    }
  }
  return { before: b, after: a }
}
