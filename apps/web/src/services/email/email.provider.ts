import type { EmailPurpose } from '@prisma/client'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
  purpose: EmailPurpose
  contactId?: string
  relatedId?: string
  templateId?: string
  textVersion?: string
  from?: string
}

export interface SendEmailResult {
  providerMessageId: string
  provider: string
}

export interface EmailEventDto {
  type: 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'OPENED' | 'CLICKED'
  providerMessageId: string
  providerEventId: string
  occurredAt: Date
  payload: unknown
  bounceType?: 'HARD' | 'SOFT' | 'UNKNOWN'
}

export interface EmailProvider {
  readonly name: string
  send(params: SendEmailParams): Promise<SendEmailResult>
  parseWebhook(headers: Headers, body: unknown, rawBody?: string): EmailEventDto[]
  verifyWebhookSignature?(headers: Headers, rawBody: string): boolean
}
