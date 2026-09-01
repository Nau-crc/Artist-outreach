import jwt from 'jsonwebtoken'

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

interface SupabaseJwtPayload extends jwt.JwtPayload {
  sub?: string
  app_metadata?: {
    role?: string
  }
}

export function verifyBearerToken(request: Request, jwtSecret = process.env.SUPABASE_JWT_SECRET): AuthClaims {
  if (!jwtSecret) {
    throw new ConfigurationError('SUPABASE_JWT_SECRET not configured')
  }

  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing bearer token')
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new UnauthorizedError('Empty bearer token')
  }

  let decoded: SupabaseJwtPayload
  try {
    decoded = jwt.verify(token, jwtSecret) as SupabaseJwtPayload
  } catch {
    throw new UnauthorizedError('Invalid token')
  }

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
 * Solo activo si:
 *   - NODE_ENV !== 'production'
 *   - DEV_BYPASS_AUTH === 'true'
 * En cualquier otro caso se ignora — imposible activarlo en producción.
 */
function tryDevBypass(): AuthClaims | null {
  if (process.env.NODE_ENV === 'production') return null
  if (process.env.DEV_BYPASS_AUTH !== 'true') return null
  return { userId: process.env.DEV_ADMIN_ID ?? DEV_ADMIN_ID, role: 'admin' }
}

export function requireAdmin(request: Request, jwtSecret?: string): AuthClaims {
  const bypass = tryDevBypass()
  if (bypass) return bypass
  const claims = verifyBearerToken(request, jwtSecret)
  if (claims.role !== 'admin') {
    throw new ForbiddenError('Admin role required')
  }
  return claims
}
