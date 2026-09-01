import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getEmailProvider } from '@/services/email/factory'
import { addSuppression } from '@/models/suppressions.model'

const PUBLIC_ACTOR_ID = '00000000-0000-0000-0000-000000000000'

/**
 * POST /api/webhooks/email/[provider].
 * Verifica firma si el provider la soporta. Ingesta idempotente:
 * la unique(message_id, event_type, provider_event_id) impide duplicados.
 * Efectos secundarios:
 *   - HARD BOUNCE → suppression(HARD_BOUNCE).
 *   - COMPLAINED  → suppression(COMPLAINT).
 */
export async function handleEmailWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const provider = getEmailProvider()

  if (provider.verifyWebhookSignature) {
    const ok = provider.verifyWebhookSignature(request.headers, rawBody)
    if (!ok) {
      logger.warn({ provider: provider.name }, 'webhook signature verification failed')
      return NextResponse.json({ error: 'InvalidSignature' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'InvalidJson' }, { status: 400 })
  }

  const events = provider.parseWebhook(request.headers, body, rawBody)
  const results: Array<{ providerMessageId: string; type: string; ingested: boolean }> = []

  for (const event of events) {
    const message = await prisma.emailMessage.findUnique({
      where: { providerMessageId: event.providerMessageId },
    })
    if (!message) {
      // Puede ser que el proveedor emita eventos de mensajes que no
      // registramos (rebote de otro sistema, prueba). Los ignoramos.
      logger.warn(
        { providerMessageId: event.providerMessageId, type: event.type },
        'webhook event for unknown message — skipping',
      )
      results.push({ providerMessageId: event.providerMessageId, type: event.type, ingested: false })
      continue
    }

    try {
      await prisma.emailEvent.create({
        data: {
          messageId: message.id,
          eventType: event.type,
          providerEventId: event.providerEventId,
          occurredAt: event.occurredAt,
          payload: (event.payload ?? {}) as Prisma.InputJsonValue,
        },
      })
    } catch (err) {
      // Unique constraint violado: evento duplicado, idempotencia OK.
      const msg = (err as Error).message
      if (msg.includes('Unique constraint')) {
        results.push({ providerMessageId: event.providerMessageId, type: event.type, ingested: false })
        continue
      }
      throw err
    }

    // Side effects
    if (event.type === 'BOUNCED' && event.bounceType === 'HARD' && message.recipient) {
      await addSuppression(
        { email: message.recipient, reason: 'HARD_BOUNCE' },
        PUBLIC_ACTOR_ID,
      )
    }
    if (event.type === 'COMPLAINED' && message.recipient) {
      await addSuppression(
        { email: message.recipient, reason: 'COMPLAINT' },
        PUBLIC_ACTOR_ID,
      )
    }

    results.push({ providerMessageId: event.providerMessageId, type: event.type, ingested: true })
  }

  return NextResponse.json({ received: events.length, results })
}
