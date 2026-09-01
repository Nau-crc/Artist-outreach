import { logger } from '@/lib/logger'
import type { EmailProvider } from './email.provider'
import { createFakeProvider } from './fake.provider'
import { createResendProvider } from './resend.provider'
import { createSmtpProvider } from './smtp.provider'

let singleton: EmailProvider | null = null

/**
 * Fábrica del provider seleccionada por EMAIL_PROVIDER:
 *   - 'resend' → requiere RESEND_API_KEY y EMAIL_FROM
 *   - 'smtp'   → requiere SMTP_HOST + SMTP_PORT + EMAIL_FROM (para Mailpit local)
 *   - 'fake'   → sin envío, solo logs (default en tests y fallback en dev)
 * La instancia se cachea para evitar reconstruir transporters.
 */
export function getEmailProvider(): EmailProvider {
  if (singleton) return singleton
  singleton = buildProvider()
  logger.info({ provider: singleton.name }, 'EmailProvider initialised')
  return singleton
}

/** Solo para tests — resetea la instancia cacheada. */
export function resetEmailProviderForTests(next?: EmailProvider): void {
  singleton = next ?? null
}

function buildProvider(): EmailProvider {
  const kind = (process.env.EMAIL_PROVIDER ?? 'fake').toLowerCase()

  if (kind === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) {
      throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM')
    }
    return createResendProvider({
      apiKey,
      from,
      ...(process.env.RESEND_WEBHOOK_SECRET
        ? { webhookSecret: process.env.RESEND_WEBHOOK_SECRET }
        : {}),
    })
  }

  if (kind === 'smtp') {
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT
    const from = process.env.EMAIL_FROM ?? 'no-reply@localhost'
    if (!host || !port) {
      throw new Error('EMAIL_PROVIDER=smtp requires SMTP_HOST and SMTP_PORT')
    }
    return createSmtpProvider({
      host,
      port: Number(port),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER ? { user: process.env.SMTP_USER } : {}),
      ...(process.env.SMTP_PASSWORD ? { password: process.env.SMTP_PASSWORD } : {}),
      from,
    })
  }

  return createFakeProvider()
}
