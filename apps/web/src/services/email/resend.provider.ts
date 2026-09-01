import { createHmac, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import { logger } from '@/lib/logger'
import type {
  EmailEventDto,
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
} from './email.provider'

export interface ResendProviderConfig {
  apiKey: string
  from: string
  webhookSecret?: string
}

/**
 * Resend provider. Requiere API key y un `from` verificado en el panel
 * de Resend. Los webhooks los envía Resend con firma Svix; si se
 * proporciona webhookSecret, verifyWebhookSignature() la valida
 * (timing-safe).
 */
export function createResendProvider(config: ResendProviderConfig): EmailProvider {
  const client = new Resend(config.apiKey)

  return {
    name: 'resend',
    async send(params: SendEmailParams): Promise<SendEmailResult> {
      const { data, error } = await client.emails.send({
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
      if (error || !data?.id) {
        throw new Error(`Resend error: ${error?.message ?? 'no id returned'}`)
      }
      logger.info(
        { to: params.to, purpose: params.purpose, providerMessageId: data.id },
        '[email:resend] send',
      )
      return { providerMessageId: data.id, provider: 'resend' }
    },

    verifyWebhookSignature(headers: Headers, rawBody: string): boolean {
      if (!config.webhookSecret) return false
      const svixId = headers.get('svix-id')
      const svixTimestamp = headers.get('svix-timestamp')
      const svixSignature = headers.get('svix-signature')
      if (!svixId || !svixTimestamp || !svixSignature) return false

      const secret = config.webhookSecret.startsWith('whsec_')
        ? config.webhookSecret.slice('whsec_'.length)
        : config.webhookSecret

      const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`
      const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
        .update(signedPayload)
        .digest('base64')

      const versions = svixSignature.split(' ').filter((s) => s.startsWith('v1,'))
      for (const version of versions) {
        const provided = version.slice('v1,'.length)
        if (provided.length !== expected.length) continue
        try {
          if (timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return true
        } catch {
          continue
        }
      }
      return false
    },

    parseWebhook(headers: Headers, body: unknown): EmailEventDto[] {
      const event = body as ResendWebhookEvent
      const type = mapResendEventType(event.type)
      if (!type) return []
      const messageId = event.data?.email_id
      if (!messageId) return []
      return [
        {
          type,
          providerMessageId: messageId,
          providerEventId: event.id ?? `${event.type}:${event.created_at}:${messageId}`,
          occurredAt: event.created_at ? new Date(event.created_at) : new Date(),
          payload: event,
          ...(event.type === 'email.bounced' ? { bounceType: bounceKind(event) } : {}),
        },
      ]
    },
  }
}

interface ResendWebhookEvent {
  id?: string
  type: string
  created_at?: string
  data?: {
    email_id?: string
    bounce?: { type?: string }
  }
}

function mapResendEventType(t: string): EmailEventDto['type'] | null {
  switch (t) {
    case 'email.sent':
      return 'SENT'
    case 'email.delivered':
      return 'DELIVERED'
    case 'email.bounced':
      return 'BOUNCED'
    case 'email.complained':
      return 'COMPLAINED'
    case 'email.opened':
      return 'OPENED'
    case 'email.clicked':
      return 'CLICKED'
    default:
      return null
  }
}

function bounceKind(event: ResendWebhookEvent): 'HARD' | 'SOFT' | 'UNKNOWN' {
  const type = event.data?.bounce?.type?.toLowerCase()
  if (!type) return 'UNKNOWN'
  if (type.includes('perm') || type.includes('hard')) return 'HARD'
  if (type.includes('trans') || type.includes('soft')) return 'SOFT'
  return 'UNKNOWN'
}
