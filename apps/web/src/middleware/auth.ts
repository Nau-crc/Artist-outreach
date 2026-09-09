import jwt from 'jsonwebtoken'
import * as jose from 'jose'

export interface AuthClaims {
  userId: string
  role?: string
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

interface SupabaseJwtPayload {
  sub?: string
  app_metadata?: {
    role?: string
  }
  [key: string]: unknown
}

// ────────────────────────────────────────────────────────────────
// JWKS remoto — Supabase moderno firma con ES256 (JWT asimétrico).
// ────────────────────────────────────────────────────────────────

let jwksCache: ReturnType<typeof jose.createRemoteJWKSet> | null = null

function getJWKS(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (jwksCache) return jwksCache
  const supabaseUrl = process.env.SUPABASE_URL
  if (!supabaseUrl) {
    throw new ConfigurationError(
      'SUPABASE_URL is required to verify asymmetric JWTs (ES256/RS256)',
    )
  }
  const url = new URL(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`)
  jwksCache = jose.createRemoteJWKSet(url)
  return jwksCache
}

/** Solo para tests — resetea el cache del JWKS. */
export function resetJWKSCacheForTests(): void {
  jwksCache = null
}

// ────────────────────────────────────────────────────────────────
// Verificación de token
// ────────────────────────────────────────────────────────────────

function decodeAlg(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8'))
    return typeof header.alg === 'string' ? header.alg : null
  } catch {
    return null
  }
}

async function verifyToken(token: string, jwtSecret?: string): Promise<SupabaseJwtPayload> {
  const alg = decodeAlg(token)
  // HMAC simétrico: Supabase legacy o tokens generados en tests.
  if (alg === 'HS256') {
    const secret = jwtSecret ?? process.env.SUPABASE_JWT_SECRET
    if (!secret) {
      throw new ConfigurationError('SUPABASE_JWT_SECRET not configured for HS256 tokens')
    }
    try {
      return jwt.verify(token, secret) as SupabaseJwtPayload
    } catch {
      throw new UnauthorizedError('Invalid token')
    }
  }
  // Asimétrico (ES256/RS256/EdDSA): Supabase moderno.
  try {
    const { payload } = await jose.jwtVerify(token, getJWKS(), {
      algorithms: ['ES256', 'RS256', 'EdDSA'],
    })
    return payload as SupabaseJwtPayload
  } catch (err) {
    if (err instanceof ConfigurationError) throw err
    throw new UnauthorizedError('Invalid token')
  }
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

export async function verifyBearerToken(
  request: Request,
  jwtSecret?: string,
): Promise<AuthClaims> {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing bearer token')
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new UnauthorizedError('Empty bearer token')
  }

  const decoded = await verifyToken(token, jwtSecret)

  if (!decoded.sub) {
    throw new UnauthorizedError('Token missing sub')
  }

  const claims: AuthClaims = { userId: decoded.sub }
  if (decoded.app_metadata?.role) {
    claims.role = decoded.app_metadata.role
  }
  return claims
}

const DEV_ADMIN_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Bypass de auth para desarrollo local.
 * Solo activo si NODE_ENV === 'development' AND DEV_BYPASS_AUTH === 'true'.
 * En producción y en test siempre se ignora.
 */
function tryDevBypass(): AuthClaims | null {
  if (process.env.NODE_ENV !== 'development') return null
  if (process.env.DEV_BYPASS_AUTH !== 'true') return null
  return { userId: process.env.DEV_ADMIN_ID ?? DEV_ADMIN_ID, role: 'admin' }
}

export async function requireAdmin(
  request: Request,
  jwtSecret?: string,
): Promise<AuthClaims> {
  const bypass = tryDevBypass()
  if (bypass) return bypass
  const claims = await verifyBearerToken(request, jwtSecret)
  if (claims.role !== 'admin') {
    throw new ForbiddenError('Admin role required')
  }
  return claims
}
