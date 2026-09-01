import { randomUUID } from 'node:crypto'
import nodemailer, { type Transporter } from 'nodemailer'
import { logger } from '@/lib/logger'
import type {
  EmailEventDto,
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
} from './email.provider'

export interface SmtpProviderConfig {
  host: string
  port: number
  secure?: boolean
  user?: string
  password?: string
  from: string
}

/**
 * SMTP provider — pensado para Mailpit en desarrollo. Envía por SMTP y
 * usa el Message-Id devuelto por nodemailer como providerMessageId.
 * No implementa webhooks (Mailpit no los tiene); parseWebhook siempre
 * devuelve [].
 */
export function createSmtpProvider(config: SmtpProviderConfig): EmailProvider {
  let transporter: Transporter | null = null

  function getTransporter(): Transporter {
    if (transporter) return transporter
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      ...(config.user && config.password
        ? { auth: { user: config.user, pass: config.password } }
        : {}),
    })
    return transporter
  }

  return {
    name: 'smtp',
    async send(params: SendEmailParams): Promise<SendEmailResult> {
      const info = await getTransporter().sendMail({
        from: params.from ?? config.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        headers: {
          'X-Purpose': params.purpose,
          ...(params.relatedId ? { 'X-Related-Id': params.relatedId } : {}),
        },
      })
      const providerMessageId = info.messageId || `smtp-${randomUUID()}`
      logger.info(
        { to: params.to, subject: params.subject, purpose: params.purpose, providerMessageId },
        '[email:smtp] send',
      )
      return { providerMessageId, provider: 'smtp' }
    },
    parseWebhook(): EmailEventDto[] {
      return []
    },
  }
}
