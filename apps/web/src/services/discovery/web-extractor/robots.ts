import robotsParser, { type Robot } from 'robots-parser'
import { logger } from '@/lib/logger'

const USER_AGENT_TOKEN = 'ArtistOutreachBot'
const CACHE_TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  robot: Robot | null
  expiresAt: number
}
const cache = new Map<string, CacheEntry>()

export interface RobotsCheckResult {
  allowed: boolean
  crawlDelayMs: number
  reason: 'robots_allowed' | 'robots_disallowed' | 'robots_missing' | 'robots_error'
  robotsUrl: string
}

/**
 * Chequea si nuestro user-agent puede visitar `targetUrl` según el
 * robots.txt del host. Nunca lanza — mapea los errores a `robots_error`.
 * Un robots.txt inexistente cuenta como "permitido" con nota (los sitios
 * pequeños raramente lo tienen).
 */
export async function checkRobots(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RobotsCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return {
      allowed: false,
      crawlDelayMs: 0,
      reason: 'robots_error',
      robotsUrl: '',
    }
  }
  const robotsUrl = `${parsed.origin}/robots.txt`

  const now = Date.now()
  const cached = cache.get(robotsUrl)
  let robot: Robot | null
  if (cached && cached.expiresAt > now) {
    robot = cached.robot
  } else {
    robot = await loadRobots(robotsUrl, fetchImpl)
    cache.set(robotsUrl, { robot, expiresAt: now + CACHE_TTL_MS })
  }

  if (!robot) {
    return {
      allowed: true,
      crawlDelayMs: 0,
      reason: 'robots_missing',
      robotsUrl,
    }
  }

  const allowed = robot.isAllowed(targetUrl, USER_AGENT_TOKEN) ?? true
  const delay = robot.getCrawlDelay(USER_AGENT_TOKEN) ?? 0

  return {
    allowed,
    crawlDelayMs: Math.max(0, delay * 1000),
    reason: allowed ? 'robots_allowed' : 'robots_disallowed',
    robotsUrl,
  }
}

export function clearRobotsCacheForTests(): void {
  cache.clear()
}

async function loadRobots(robotsUrl: string, fetchImpl: typeof fetch): Promise<Robot | null> {
  try {
    const res = await fetchImpl(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT_TOKEN },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404) return null
    if (!res.ok) {
      logger.warn({ robotsUrl, status: res.status }, 'robots.txt fetch non-ok — treating as missing')
      return null
    }
    const text = await res.text()
    return robotsParser(robotsUrl, text)
  } catch (err) {
    logger.warn({ err, robotsUrl }, 'robots.txt fetch error — treating as missing')
    return null
  }
}
