import type { Contact, NewsletterSubscription, Prisma } from '@prisma/client'
import { Email } from '@artist-outreach/shared'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/tokens'
import { writeAudit } from './audit.model'
import { sendEmail } from './email.model'
import { addSuppression, isSuppressed } from './suppressions.model'

const CONFIRMATION_TTL_HOURS = 48

// ────────────────────────────────────────────────────────────────
// Types + errors
// ────────────────────────────────────────────────────────────────

export interface SubscribeInput {
  email: string
  metadata?: {
    ip?: string
    userAgent?: string
    referrer?: string
  }
}

export interface SubscribeResult {
  status: 'PENDING_CONFIRMATION' | 'ALREADY_CONFIRMED' | 'SUPPRESSED'
  subscription?: NewsletterSubscription
}

export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid or expired token')
    this.name = 'InvalidTokenError'
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor() {
    super('Subscription not found')
    this.name = 'SubscriptionNotFoundError'
  }
}

// ────────────────────────────────────────────────────────────────
// Subscribe (public)
// ────────────────────────────────────────────────────────────────

export const NEWSLETTER_TEXT_VERSION = 'newsletter-v1'

/**
 * Alta pública de newsletter. Idempotente:
 *   - Si el email está suprimido → SUPPRESSED silencioso (no revela).
 *   - Si ya hay una subscripción CONFIRMED → ALREADY_CONFIRMED (no reenvía).
 *   - Si hay una PENDING_CONFIRMATION → reutiliza o regenera token, reenvía.
 *   - Si no hay contact, crea uno con contactStatus=REVIEWED y
 *     consentStatus=UNKNOWN (el consent se registrará al confirmar).
 * Envía email de confirmación (transaccional, respuesta a acción del usuario).
 */
export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const email = Email.parse(input.email).value

  if (await isSuppressed(email)) {
    return { status: 'SUPPRESSED' }
  }

  const existingActive = await prisma.newsletterSubscription.findFirst({
    where: {
      contact: { email },
      status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] },
    },
    include: { contact: true },
  })
  if (existingActive?.status === 'CONFIRMED') {
    return { status: 'ALREADY_CONFIRMED', subscription: existingActive }
  }

  return prisma.$transaction(async (tx) => {
    const contact = await getOrCreateContact(tx, email)

    let subscription: NewsletterSubscription
    if (existingActive) {
      subscription = await tx.newsletterSubscription.update({
        where: { id: existingActive.id },
        data: {
          confirmationToken: generateToken(),
          confirmationExpiresAt: expiresAt(),
        },
      })
    } else {
      subscription = await tx.newsletterSubscription.create({
        data: {
          contactId: contact.id,
          status: 'PENDING_CONFIRMATION',
          confirmationToken: generateToken(),
          confirmationExpiresAt: expiresAt(),
          unsubscribeToken: generateToken(),
        },
      })
    }

    await writeAudit(
      {
        actorId: null,
        actorKind: 'PUBLIC',
        entityType: 'newsletter_subscription',
        entityId: subscription.id,
        action: existingActive ? 'confirmation_resent' : 'subscribe_requested',
        after: { contactId: contact.id, email },
        metadata: input.metadata ?? {},
      },
      tx,
    )

    return { status: 'PENDING_CONFIRMATION' as const, subscription }
  })
}

// ────────────────────────────────────────────────────────────────
// Send confirmation email (called after subscribe in the controller)
// ────────────────────────────────────────────────────────────────

export async function sendConfirmationEmail(
  subscriptionId: string,
  baseUrl: string,
): Promise<void> {
  const sub = await prisma.newsletterSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { contact: true },
  })
  if (!sub.contact.email) return
  if (sub.status !== 'PENDING_CONFIRMATION') return

  const confirmUrl = `${baseUrl.replace(/\/+$/, '')}/subscribe/confirm/${sub.confirmationToken}`
  const unsubUrl = `${baseUrl.replace(/\/+$/, '')}/unsubscribe/${sub.unsubscribeToken}`

  const { text, html } = renderConfirmationEmail(confirmUrl, unsubUrl)

  await sendEmail({
    to: sub.contact.email,
    subject: 'Confirma tu suscripción a la newsletter',
    text,
    html,
    purpose: 'DOUBLE_OPTIN',
    contactId: sub.contactId,
    relatedId: sub.id,
    textVersion: NEWSLETTER_TEXT_VERSION,
  })
}

// ────────────────────────────────────────────────────────────────
// Confirm (public — accessed via emailed token)
// ────────────────────────────────────────────────────────────────

export async function confirm(token: string): Promise<NewsletterSubscription> {
  const found = await prisma.newsletterSubscription.findUnique({
    where: { confirmationToken: token },
  })
  if (!found) throw new InvalidTokenError()
  if (found.status === 'CONFIRMED') return found
  if (found.status === 'UNSUBSCRIBED') throw new InvalidTokenError()
  if (found.confirmationExpiresAt && found.confirmationExpiresAt < new Date()) {
    throw new InvalidTokenError()
  }

  return prisma.$transaction(async (tx) => {
    const consent = await tx.consent.create({
      data: {
        contactId: found.contactId,
        purpose: 'NEWSLETTER',
        status: 'CONFIRMED',
        source: 'PUBLIC_FORM',
        textVersion: NEWSLETTER_TEXT_VERSION,
      },
    })

    const updated = await tx.newsletterSubscription.update({
      where: { id: found.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmationToken: null,
        confirmationExpiresAt: null,
        consentId: consent.id,
      },
    })

    await tx.contact.update({
      where: { id: found.contactId },
      data: { consentStatus: 'CONFIRMED', lastActionAt: new Date() },
    })

    await writeAudit(
      {
        actorId: null,
        actorKind: 'PUBLIC',
        entityType: 'newsletter_subscription',
        entityId: updated.id,
        action: 'confirmed',
        after: { consentId: consent.id },
      },
      tx,
    )
    await writeAudit(
      {
        actorId: null,
        actorKind: 'PUBLIC',
        entityType: 'consent',
        entityId: consent.id,
        action: 'granted',
        after: { purpose: 'NEWSLETTER', source: 'PUBLIC_FORM', textVersion: NEWSLETTER_TEXT_VERSION },
      },
      tx,
    )

    return updated
  })
}

// ────────────────────────────────────────────────────────────────
// Unsubscribe (public — permanent token, does not expire)
// ────────────────────────────────────────────────────────────────

export interface UnsubscribeResult {
  status: 'UNSUBSCRIBED' | 'ALREADY_UNSUBSCRIBED' | 'INVALID'
  email?: string
}

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  const sub = await prisma.newsletterSubscription.findUnique({
    where: { unsubscribeToken: token },
    include: { contact: true },
  })
  if (!sub) return { status: 'INVALID' }
  if (sub.status === 'UNSUBSCRIBED') {
    return { status: 'ALREADY_UNSUBSCRIBED', ...(sub.contact.email ? { email: sub.contact.email } : {}) }
  }

  await prisma.$transaction(async (tx) => {
    await tx.newsletterSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
      },
    })
    if (sub.consentId) {
      await tx.consent.update({
        where: { id: sub.consentId },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      })
      await writeAudit(
        {
          actorId: null,
          actorKind: 'PUBLIC',
          entityType: 'consent',
          entityId: sub.consentId,
          action: 'withdrawn',
          metadata: { via: 'unsubscribe_link' },
        },
        tx,
      )
    }
    await tx.contact.update({
      where: { id: sub.contactId },
      data: { consentStatus: 'WITHDRAWN', lastActionAt: new Date() },
    })
    await writeAudit(
      {
        actorId: null,
        actorKind: 'PUBLIC',
        entityType: 'newsletter_subscription',
        entityId: sub.id,
        action: 'unsubscribed',
      },
      tx,
    )
  })

  // Suppress fuera de la transacción — addSuppression usa su propio $transaction.
  if (sub.contact.email) {
    await addSuppression(
      { email: sub.contact.email, reason: 'UNSUBSCRIBE' },
      // actor sintético para acciones públicas
      '00000000-0000-0000-0000-000000000000',
    )
  }

  return {
    status: 'UNSUBSCRIBED',
    ...(sub.contact.email ? { email: sub.contact.email } : {}),
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function getOrCreateContact(
  tx: Prisma.TransactionClient,
  email: string,
): Promise<Contact> {
  const existing = await tx.contact.findUnique({ where: { email } })
  if (existing) return existing
  return tx.contact.create({
    data: {
      artistName: email.split('@')[0] ?? 'Suscriptor',
      email,
      contactStatus: 'REVIEWED',
      emailStatus: 'FOUND',
      permission: 'NOT_REVIEWED',
    },
  })
}

function expiresAt(): Date {
  return new Date(Date.now() + CONFIRMATION_TTL_HOURS * 60 * 60 * 1000)
}

function renderConfirmationEmail(confirmUrl: string, unsubUrl: string) {
  const text = [
    'Gracias por interesarte en nuestra newsletter para artistas.',
    '',
    'Para confirmar tu suscripción, pulsa este enlace:',
    confirmUrl,
    '',
    `Si no eres tú, ignora este mensaje. Puedes darte de baja en cualquier momento aquí: ${unsubUrl}`,
  ].join('\n')

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0B0B0F">
      <h1 style="font-size: 24px; margin: 0 0 16px;">Confirma tu suscripción</h1>
      <p style="font-size: 16px; line-height: 1.5;">Gracias por interesarte en nuestra newsletter para artistas.</p>
      <p style="text-align: center; margin: 32px 0">
        <a href="${confirmUrl}" style="background: #5B60F0; color: #FFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600">Confirmar suscripción</a>
      </p>
      <p style="font-size: 12px; color: #8B8B95">Si no eres tú, ignora este mensaje.<br>Puedes darte de baja en cualquier momento <a href="${unsubUrl}" style="color: #8B8B95">aquí</a>.</p>
    </div>
  `.trim()

  return { text, html }
}
