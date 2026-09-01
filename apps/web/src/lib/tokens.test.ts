import { describe, expect, it } from 'vitest'
import { generateToken, tokensEqual } from './tokens'

describe('generateToken', () => {
  it('produces url-safe strings', () => {
    for (let i = 0; i < 20; i++) {
      const t = generateToken()
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('produces distinct tokens', () => {
    const s = new Set<string>()
    for (let i = 0; i < 100; i++) s.add(generateToken())
    expect(s.size).toBe(100)
  })

  it('accepts custom byte length', () => {
    const t = generateToken(16)
    // 16 bytes → 22 chars base64url
    expect(t.length).toBeGreaterThanOrEqual(20)
    expect(t.length).toBeLessThanOrEqual(24)
  })
})

describe('tokensEqual', () => {
  it('true for identical strings', () => {
    expect(tokensEqual('abc', 'abc')).toBe(true)
  })

  it('false for different content of same length', () => {
    expect(tokensEqual('abc', 'abd')).toBe(false)
  })

  it('false for different lengths', () => {
    expect(tokensEqual('abc', 'abcd')).toBe(false)
  })
})
