import { describe, expect, it } from 'vitest'
import { healthController } from '../src/controllers/health.controller'

describe('healthController', () => {
  it('returns ok', async () => {
    const res = await healthController()
    expect(res.status).toBe('ok')
    expect(res.service).toBe('artist-outreach-web')
    expect(new Date(res.time).toString()).not.toBe('Invalid Date')
  })
})
