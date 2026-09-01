import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, it } from 'vitest'
import { ForbiddenError, UnauthorizedError, requireAdmin, verifyBearerToken } from './auth'

const SECRET = 'test-secret-do-not-use-in-prod'

function tokenFor(payload: Record<string, unknown>): string {
  return jwt.sign(payload, SECRET, { expiresIn: '5m' })
}

function reqWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/x', { headers })
}

describe('verifyBearerToken', () => {
  it('extracts userId from valid token', () => {
    const token = tokenFor({ sub: 'user-1' })
    const claims = verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET)
    expect(claims.userId).toBe('user-1')
    expect(claims.role).toBeUndefined()
  })

  it('reads role from app_metadata', () => {
    const token = tokenFor({ sub: 'user-1', app_metadata: { role: 'admin' } })
    const claims = verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET)
    expect(claims.role).toBe('admin')
  })

  it('rejects missing header', () => {
    expect(() => verifyBearerToken(reqWith({}), SECRET)).toThrow(UnauthorizedError)
  })

  it('rejects malformed header', () => {
    expect(() => verifyBearerToken(reqWith({ authorization: 'Basic abc' }), SECRET)).toThrow(UnauthorizedError)
  })

  it('rejects tampered token', () => {
    const token = tokenFor({ sub: 'user-1' })
    expect(() =>
      verifyBearerToken(reqWith({ authorization: `Bearer ${token}tampered` }), SECRET),
    ).toThrow(UnauthorizedError)
  })

  it('rejects token signed with a different secret', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'other-secret')
    expect(() => verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET)).toThrow(
      UnauthorizedError,
    )
  })

  it('rejects token without sub', () => {
    const token = tokenFor({ email: 'x@example.com' })
    expect(() => verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET)).toThrow(
      UnauthorizedError,
    )
  })
})

describe('requireAdmin', () => {
  it('accepts admin role', () => {
    const token = tokenFor({ sub: 'user-1', app_metadata: { role: 'admin' } })
    const claims = requireAdmin(reqWith({ authorization: `Bearer ${token}` }), SECRET)
    expect(claims.role).toBe('admin')
  })

  it('rejects non-admin', () => {
    const token = tokenFor({ sub: 'user-1', app_metadata: { role: 'user' } })
    expect(() => requireAdmin(reqWith({ authorization: `Bearer ${token}` }), SECRET)).toThrow(
      ForbiddenError,
    )
  })

  it('rejects when role missing', () => {
    const token = tokenFor({ sub: 'user-1' })
    expect(() => requireAdmin(reqWith({ authorization: `Bearer ${token}` }), SECRET)).toThrow(
      ForbiddenError,
    )
  })
})

describe('DEV_BYPASS_AUTH', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalBypass = process.env.DEV_BYPASS_AUTH

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalBypass === undefined) delete process.env.DEV_BYPASS_AUTH
    else process.env.DEV_BYPASS_AUTH = originalBypass
  })

  it('injects admin claims when flag is set in non-production', () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_BYPASS_AUTH = 'true'
    const claims = requireAdmin(reqWith({}), SECRET)
    expect(claims.role).toBe('admin')
    expect(claims.userId).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('is ignored in production even with flag set', () => {
    process.env.NODE_ENV = 'production'
    process.env.DEV_BYPASS_AUTH = 'true'
    expect(() => requireAdmin(reqWith({}), SECRET)).toThrow(UnauthorizedError)
  })

  it('is ignored when flag is not exactly "true"', () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_BYPASS_AUTH = '1'
    expect(() => requireAdmin(reqWith({}), SECRET)).toThrow(UnauthorizedError)
  })
})
