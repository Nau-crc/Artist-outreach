import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  InvalidTokenError,
  confirm,
  sendConfirmationEmail,
  subscribe,
  unsubscribe,
} from '@/models/newsletter.model'
import type { ControllerInput } from '@/middleware/with-controller'
import { NotFoundError } from '@/middleware/with-controller'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

export const PublicSubscribeSchema = z
  .object({
    email: z.string().email(),
    honeypot: z.string().max(0).optional(), // debe estar vacío o ausente
    referrer: z.string().max(500).optional(),
  })
  .strict()

export const TokenParamsSchema = z.object({
  token: z.string().min(20).max(200),
})

export type PublicSubscribeInput = z.infer<typeof PublicSubscribeSchema>
export type TokenParams = z.infer<typeof TokenParamsSchema>

// ────────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────────

/**
 * POST /api/public/subscribe.
 * Nunca revela si el email existe o está suprimido — siempre responde
 * { status: 'ok' } salvo error de validación (400).
 */
export async function subscribePublicController(
  input: ControllerInput<PublicSubscribeInput, unknown>,
) {
  const ip = 'ip-from-header' // ya validado por el rate limiter
  const ua = 'unknown'
  const metadata: { ip?: string; userAgent?: string; referrer?: string } = { ip, userAgent: ua }
  if (input.body.referrer) metadata.referrer = input.body.referrer

  const result = await subscribe({ email: input.body.email, metadata })
  // Envío del email de confirmación en modo fire-and-forget — no bloquea
  // la respuesta al usuario. Errores se loggean.
  if (result.status === 'PENDING_CONFIRMATION' && result.subscription) {
    sendConfirmationEmail(result.subscription.id, APP_URL).catch((err) => {
      logger.error({ err, subscriptionId: result.subscription!.id }, 'send confirmation email failed')
    })
  }
  return { status: 'ok' as const }
}

/**
 * POST /api/public/confirm/[token].
 * Devuelve { status: 'confirmed' } o 404 si el token es inválido/expirado.
 */
export async function confirmPublicController(
  input: ControllerInput<void, TokenParams>,
) {
  try {
    const sub = await confirm(input.ctx.params.token)
    return { status: 'confirmed' as const, contactId: sub.contactId }
  } catch (err) {
    if (err instanceof InvalidTokenError) throw new NotFoundError('Token inválido o expirado')
    throw err
  }
}

/**
 * POST /api/public/unsubscribe/[token].
 * Siempre 200. { status: 'unsubscribed' | 'already' | 'invalid' }.
 */
export async function unsubscribePublicController(
  input: ControllerInput<void, TokenParams>,
) {
  const result = await unsubscribe(input.ctx.params.token)
  return { status: result.status.toLowerCase() as 'unsubscribed' | 'already_unsubscribed' | 'invalid' }
}
