import { describe, expect, it } from 'vitest'
import { createFakeProvider } from './fake.provider'

describe('fake email provider', () => {
  it('returns synthetic providerMessageId prefixed with fake-', async () => {
    const p = createFakeProvider()
    const r = await p.send({
      to: 'test@x.com',
      subject: 'hi',
      html: '<p>hi</p>',
      text: 'hi',
      purpose: 'SYSTEM',
    })
    expect(r.providerMessageId).toMatch(/^fake-[0-9a-f-]+$/)
    expect(r.provider).toBe('fake')
  })

  it('parseWebhook returns empty (no events for fake)', () => {
    const p = createFakeProvider()
    expect(p.parseWebhook(new Headers(), {})).toEqual([])
  })
})
