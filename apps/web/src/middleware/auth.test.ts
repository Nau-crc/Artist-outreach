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
  it('extracts userId from valid token', async () => {
    const token = tokenFor({ sub: 'user-1' })
    const claims = await verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET)
    expect(claims.userId).toBe('user-1')
    expect(claims.role).toBeUndefined()
  })

  it('reads role from app_metadata', async () => {
    const token = tokenFor({ sub: 'user-1', app_metadata: { role: 'admin' } })
    const claims = await verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET)
    expect(claims.role).toBe('admin')
  })

  it('rejects missing header', async () => {
    await expect(verifyBearerToken(reqWith({}), SECRET)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects malformed header', async () => {
    await expect(
      verifyBearerToken(reqWith({ authorization: 'Basic abc' }), SECRET),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects tampered token', async () => {
    const token = tokenFor({ sub: 'user-1' })
    await expect(
      verifyBearerToken(reqWith({ authorization: `Bearer ${token}tampered` }), SECRET),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects token signed with a different secret', async () => {
    const token = jwt.sign({ sub: 'user-1' }, 'other-secret')
    await expect(
      verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects token without sub', async () => {
    const token = tokenFor({ email: 'x@example.com' })
    await expect(
      verifyBearerToken(reqWith({ authorization: `Bearer ${token}` }), SECRET),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })
})

describe('requireAdmin', () => {
  it('accepts admin role', async () => {
    const token = tokenFor({ sub: 'user-1', app_metadata: { role: 'admin' } })
    const claims = await requireAdmin(reqWith({ authorization: `Bearer ${token}` }), SECRET)
    expect(claims.role).toBe('admin')
  })

  it('rejects non-admin', async () => {
    const token = tokenFor({ sub: 'user-1', app_metadata: { role: 'user' } })
    await expect(
      requireAdmin(reqWith({ authorization: `Bearer ${token}` }), SECRET),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('rejects when role missing', async () => {
    const token = tokenFor({ sub: 'user-1' })
    await expect(
      requireAdmin(reqWith({ authorization: `Bearer ${token}` }), SECRET),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('DEV_BYPASS_AUTH', () => {
  const originalNodeEnv = (process.env as Record<string, string | undefined>).NODE_ENV
  const originalBypass = process.env.DEV_BYPASS_AUTH

  afterEach(() => {
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
    else (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
    if (originalBypass === undefined) delete process.env.DEV_BYPASS_AUTH
    else process.env.DEV_BYPASS_AUTH = originalBypass
  })

  it('injects admin claims when flag is set in non-production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    process.env.DEV_BYPASS_AUTH = 'true'
    const claims = await requireAdmin(reqWith({}), SECRET)
    expect(claims.role).toBe('admin')
    expect(claims.userId).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('is ignored in production even with flag set', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    process.env.DEV_BYPASS_AUTH = 'true'
    await expect(requireAdmin(reqWith({}), SECRET)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('is ignored in test env even with flag set', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    process.env.DEV_BYPASS_AUTH = 'true'
    await expect(requireAdmin(reqWith({}), SECRET)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('is ignored when flag is not exactly "true"', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    process.env.DEV_BYPASS_AUTH = '1'
    await expect(requireAdmin(reqWith({}), SECRET)).rejects.toBeInstanceOf(UnauthorizedError)
  })
})
