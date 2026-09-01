/**
 * Rate limiter in-memory por IP. Ventana rodante con token bucket
 * simplificado. Suficiente para dev y para volúmenes bajos en single-node.
 * Para prod multi-instance sustituir por Upstash Redis con la misma
 * signature (checkRateLimit → { allowed, retryAfter }).
 */
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export interface RateLimitParams {
  key: string
  limit: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(params: RateLimitParams): RateLimitResult {
  const now = Date.now()
  const windowMs = params.windowSeconds * 1000
  const bucket = buckets.get(params.key)
  if (!bucket || bucket.resetAt < now) {
    const next: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(params.key, next)
    return { allowed: true, remaining: params.limit - 1, resetAt: next.resetAt }
  }
  if (bucket.count >= params.limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }
  bucket.count += 1
  return { allowed: true, remaining: params.limit - bucket.count, resetAt: bucket.resetAt }
}

export function resetRateLimitsForTests(): void {
  buckets.clear()
}

export function ipFromRequest(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
