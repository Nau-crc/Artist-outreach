import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createResendProvider } from './resend.provider'

const SECRET = 'test-secret-base64==' // handled as base64
const WEBHOOK_SECRET = 'whsec_' + Buffer.from(SECRET).toString('base64')

function signHeaders(id: string, timestamp: string, body: string) {
  const secret = WEBHOOK_SECRET.slice('whsec_'.length)
  const sig = createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  const headers = new Headers()
  headers.set('svix-id', id)
  headers.set('svix-timestamp', timestamp)
  headers.set('svix-signature', `v1,${sig}`)
  return headers
}

describe('resend provider — webhook parsing', () => {
  const p = createResendProvider({ apiKey: 'k', from: 'x@x', webhookSecret: WEBHOOK_SECRET })

  it('maps email.delivered to DELIVERED', () => {
    const events = p.parseWebhook(new Headers(), {
      id: 'evt-1',
      type: 'email.delivered',
      created_at: '2026-09-01T00:00:00.000Z',
      data: { email_id: 'msg-1' },
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('DELIVERED')
    expect(events[0]?.providerMessageId).toBe('msg-1')
    expect(events[0]?.providerEventId).toBe('evt-1')
  })

  it('maps email.bounced with hard bounce', () => {
    const events = p.parseWebhook(new Headers(), {
      id: 'evt-2',
      type: 'email.bounced',
      data: { email_id: 'msg-2', bounce: { type: 'Permanent' } },
    })
    expect(events[0]?.type).toBe('BOUNCED')
    expect(events[0]?.bounceType).toBe('HARD')
  })

  it('ignores unknown event types', () => {
    const events = p.parseWebhook(new Headers(), { type: 'email.opened.pixel', data: { email_id: 'x' } })
    expect(events).toEqual([])
  })

  it('ignores events without email_id', () => {
    const events = p.parseWebhook(new Headers(), { type: 'email.delivered', data: {} })
    expect(events).toEqual([])
  })
})

describe('resend provider — verifyWebhookSignature', () => {
  const p = createResendProvider({ apiKey: 'k', from: 'x@x', webhookSecret: WEBHOOK_SECRET })

  it('accepts valid signature', () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg-1' } })
    const headers = signHeaders('id1', String(Date.now()), body)
    expect(p.verifyWebhookSignature!(headers, body)).toBe(true)
  })

  it('rejects tampered body', () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg-1' } })
    const headers = signHeaders('id1', String(Date.now()), body)
    expect(p.verifyWebhookSignature!(headers, body + 'tampered')).toBe(false)
  })

  it('rejects missing headers', () => {
    expect(p.verifyWebhookSignature!(new Headers(), 'body')).toBe(false)
  })

  it('returns false when no webhookSecret configured', () => {
    const unsigned = createResendProvider({ apiKey: 'k', from: 'x@x' })
    const headers = signHeaders('id', String(Date.now()), 'body')
    expect(unsigned.verifyWebhookSignature!(headers, 'body')).toBe(false)
  })
})
