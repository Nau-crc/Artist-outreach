import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import { resetEmailProviderForTests } from '@/services/email/factory'
import { createFakeProvider } from '@/services/email/fake.provider'
import { handleEmailWebhook } from './webhook-email.controller'
import { sendEmail } from '@/models/email.model'
import { isSuppressed } from '@/models/suppressions.model'

function webhookRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks/email/fake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('handleEmailWebhook (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
    // Fake provider mejorado para tests: parsea sus propios "webhooks" simples
    // con shape { type, providerMessageId, providerEventId, bounceType? }.
    const provider = {
      ...createFakeProvider(),
      name: 'fake',
      parseWebhook(_h: Headers, body: unknown) {
        const b = body as { events?: Array<{ type: string; providerMessageId: string; providerEventId: string; bounceType?: 'HARD' | 'SOFT' | 'UNKNOWN' }> }
        return (b.events ?? []).map((e) => ({
          type: e.type as 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'OPENED' | 'CLICKED',
          providerMessageId: e.providerMessageId,
          providerEventId: e.providerEventId,
          occurredAt: new Date(),
          payload: e,
          ...(e.bounceType ? { bounceType: e.bounceType } : {}),
        }))
      },
    }
    resetEmailProviderForTests(provider)
  })

  afterAll(async () => {
    resetEmailProviderForTests()
    await disconnect()
  })

  async function seedMessage(recipient = 'test@x.com') {
    const { message } = await sendEmail({
      to: recipient,
      subject: 's',
      html: '<p>x</p>',
      text: 'x',
      purpose: 'SYSTEM',
    })
    return message
  }

  it('ingests DELIVERED and writes email_events', async () => {
    const msg = await seedMessage()
    const res = await handleEmailWebhook(
      webhookRequest({ events: [{ type: 'DELIVERED', providerMessageId: msg.providerMessageId, providerEventId: 'e1' }] }),
    )
    expect(res.status).toBe(200)
    const events = await prisma.emailEvent.findMany({ where: { messageId: msg.id } })
    expect(events).toHaveLength(1)
    expect(events[0]?.eventType).toBe('DELIVERED')
  })

  it('is idempotent — replaying the same event does not duplicate', async () => {
    const msg = await seedMessage()
    const req = () =>
      handleEmailWebhook(
        webhookRequest({ events: [{ type: 'DELIVERED', providerMessageId: msg.providerMessageId, providerEventId: 'same-id' }] }),
      )
    await req()
    await req()
    expect(await prisma.emailEvent.count({ where: { messageId: msg.id } })).toBe(1)
  })

  it('HARD bounce triggers suppression', async () => {
    const msg = await seedMessage('bounces@x.com')
    await handleEmailWebhook(
      webhookRequest({
        events: [
          {
            type: 'BOUNCED',
            providerMessageId: msg.providerMessageId,
            providerEventId: 'e-b1',
            bounceType: 'HARD',
          },
        ],
      }),
    )
    expect(await isSuppressed('bounces@x.com')).toBe(true)
  })

  it('SOFT bounce does not suppress', async () => {
    const msg = await seedMessage('soft@x.com')
    await handleEmailWebhook(
      webhookRequest({
        events: [
          {
            type: 'BOUNCED',
            providerMessageId: msg.providerMessageId,
            providerEventId: 'e-b2',
            bounceType: 'SOFT',
          },
        ],
      }),
    )
    expect(await isSuppressed('soft@x.com')).toBe(false)
  })

  it('COMPLAINED triggers suppression', async () => {
    const msg = await seedMessage('complains@x.com')
    await handleEmailWebhook(
      webhookRequest({
        events: [
          {
            type: 'COMPLAINED',
            providerMessageId: msg.providerMessageId,
            providerEventId: 'e-c1',
          },
        ],
      }),
    )
    expect(await isSuppressed('complains@x.com')).toBe(true)
  })

  it('ignores events for unknown providerMessageId', async () => {
    const res = await handleEmailWebhook(
      webhookRequest({ events: [{ type: 'DELIVERED', providerMessageId: 'unknown-msg', providerEventId: 'e' }] }),
    )
    expect(res.status).toBe(200)
    expect(await prisma.emailEvent.count()).toBe(0)
  })
})
