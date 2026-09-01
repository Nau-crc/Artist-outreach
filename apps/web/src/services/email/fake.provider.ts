import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'
import type {
  EmailEventDto,
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
} from './email.provider'

/**
 * Fake provider: no envía nada. Loguea la solicitud y devuelve un id
 * sintético. Útil para tests y para dev sin infra de email.
 */
export function createFakeProvider(): EmailProvider {
  const sent: Array<SendEmailParams & { providerMessageId: string }> = []
  return {
    name: 'fake',
    async send(params: SendEmailParams): Promise<SendEmailResult> {
      const providerMessageId = `fake-${randomUUID()}`
      sent.push({ ...params, providerMessageId })
      logger.info(
        { to: params.to, subject: params.subject, purpose: params.purpose, providerMessageId },
        '[email:fake] send',
      )
      return { providerMessageId, provider: 'fake' }
    },
    parseWebhook(): EmailEventDto[] {
      return []
    },
  }
}
