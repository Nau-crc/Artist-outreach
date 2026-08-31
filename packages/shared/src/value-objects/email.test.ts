import { describe, expect, it } from 'vitest'
import { Email, InvalidEmailError } from './email'

describe('Email', () => {
  it('parses valid email lowercased and trimmed', () => {
    const email = Email.parse('  User@Example.COM ')
    expect(email.value).toBe('user@example.com')
  })

  it('rejects invalid syntax', () => {
    expect(() => Email.parse('not-an-email')).toThrow(InvalidEmailError)
    expect(() => Email.parse('a@b')).toThrow(InvalidEmailError)
    expect(() => Email.parse('@nohost.com')).toThrow(InvalidEmailError)
  })

  it('strips zero-width chars', () => {
    const email = Email.parse('a​b@example.com')
    expect(email.value).toBe('ab@example.com')
  })

  it('safeParse never throws', () => {
    const bad = Email.safeParse('nope')
    expect(bad.success).toBe(false)
    const ok = Email.safeParse('x@y.com')
    expect(ok.success).toBe(true)
  })
})
