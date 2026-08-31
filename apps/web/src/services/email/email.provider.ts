// Interface del servicio de email. Implementaciones concretas en fase 4.
// No se llama desde ninguna parte del código en fase 1.

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
  purpose: 'CONSENT_REQUEST' | 'DOUBLE_OPTIN' | 'NEWSLETTER' | 'SYSTEM'
  relatedId?: string
}

export interface SendEmailResult {
  providerMessageId: string
}

export interface EmailEvent {
  type: 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'OPENED' | 'CLICKED'
  providerMessageId: string
  providerEventId: string
  occurredAt: Date
  payload: unknown
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>
  parseWebhook(headers: Headers, body: unknown): EmailEvent[]
}
