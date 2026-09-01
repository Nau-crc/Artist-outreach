import { beforeEach, describe, expect, it } from 'vitest'
import { checkRateLimit, resetRateLimitsForTests } from './rate-limit'

describe('rate limit', () => {
  beforeEach(() => resetRateLimitsForTests())

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit({ key: 'k', limit: 5, windowSeconds: 60 })
      expect(r.allowed).toBe(true)
    }
    const denied = checkRateLimit({ key: 'k', limit: 5, windowSeconds: 60 })
    expect(denied.allowed).toBe(false)
  })

  it('isolates by key', () => {
    checkRateLimit({ key: 'a', limit: 1, windowSeconds: 60 })
    const bResult = checkRateLimit({ key: 'b', limit: 1, windowSeconds: 60 })
    expect(bResult.allowed).toBe(true)
  })

  it('resets after window (simulated)', () => {
    const r1 = checkRateLimit({ key: 'k', limit: 1, windowSeconds: 60 })
    expect(r1.allowed).toBe(true)
    const r2 = checkRateLimit({ key: 'k', limit: 1, windowSeconds: 60 })
    expect(r2.allowed).toBe(false)
    // Simulamos que la ventana pasó: reset y comprobamos.
    resetRateLimitsForTests()
    const r3 = checkRateLimit({ key: 'k', limit: 1, windowSeconds: 60 })
    expect(r3.allowed).toBe(true)
  })
})
