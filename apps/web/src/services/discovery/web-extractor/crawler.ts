import type { DiscoveryResult } from '@artist-outreach/shared'
import { logger } from '@/lib/logger'
import { checkRobots } from './robots'
import { parsePage } from './extract'

const USER_AGENT = 'ArtistOutreachBot/0.1 (+contact-your-admin)'
const DEFAULT_RATE_LIMIT_MS = 1000
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_CONSECUTIVE_ERRORS = 10

export interface CrawlOptions {
  startUrl: string
  maxPages: number
  maxDepth: number
  rateLimitMs?: number
  timeoutMs?: number
}

export interface CrawlPageOutcome {
  url: string
  depth: number
  status: number | 'skipped_robots' | 'error'
  emailsFound: number
  error?: string
}

export interface CrawlReport {
  visitedCount: number
  emailsCount: number
  results: DiscoveryResult[]
  pages: CrawlPageOutcome[]
  aborted: boolean
  abortReason?: string
}

/**
 * Crawler BFS acotado al mismo host que startUrl. Para cada URL:
 *   1. Chequea robots.txt (si disallowed, la salta).
 *   2. Fetch con User-Agent identificable y timeout.
 *   3. Parsea, extrae emails y links.
 *   4. Encola links del mismo host hasta maxDepth y maxPages.
 * Respeta crawlDelay del robots.txt si es mayor que rateLimitMs.
 * Aborta si acumula MAX_CONSECUTIVE_ERRORS errores seguidos.
 */
export async function crawlSite(
  opts: CrawlOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<CrawlReport> {
  const rateLimit = opts.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const startHost = new URL(opts.startUrl).hostname
  const queue: Array<{ url: string; depth: number }> = [{ url: opts.startUrl, depth: 0 }]
  const visited = new Set<string>()
  const pages: CrawlPageOutcome[] = []
  const results: DiscoveryResult[] = []
  const seenEmails = new Set<string>()
  let consecutiveErrors = 0
  let lastFetchAt = 0
  let aborted = false
  let abortReason: string | undefined

  while (queue.length > 0 && visited.size < opts.maxPages) {
    const next = queue.shift()!
    if (visited.has(next.url)) continue
    visited.add(next.url)

    if (new URL(next.url).hostname !== startHost) continue

    // 1. robots.txt
    const robots = await checkRobots(next.url, fetchImpl)
    const effectiveDelay = Math.max(rateLimit, robots.crawlDelayMs)
    if (!robots.allowed) {
      pages.push({ url: next.url, depth: next.depth, status: 'skipped_robots', emailsFound: 0 })
      continue
    }

    // 2. rate limit
    const wait = lastFetchAt + effectiveDelay - Date.now()
    if (wait > 0) await sleep(wait)
    lastFetchAt = Date.now()

    // 3. fetch
    try {
      const res = await fetchImpl(next.url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!res.ok || !contentType.includes('text/html')) {
        pages.push({
          url: next.url,
          depth: next.depth,
          status: res.status,
          emailsFound: 0,
          error: res.ok ? `Skipped non-html (${contentType})` : `HTTP ${res.status}`,
        })
        consecutiveErrors = res.ok ? 0 : consecutiveErrors + 1
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          aborted = true
          abortReason = `Aborted after ${consecutiveErrors} consecutive errors`
          break
        }
        continue
      }
      consecutiveErrors = 0
      const html = await res.text()
      const page = parsePage(html, next.url)

      pages.push({
        url: next.url,
        depth: next.depth,
        status: res.status,
        emailsFound: page.emails.length,
      })

      for (const email of page.emails) {
        if (seenEmails.has(email)) continue
        seenEmails.add(email)
        results.push({
          artistName: page.artistName ?? email.split('@')[0]!,
          email,
          website: `${new URL(next.url).origin}`,
          discipline: null,
          country: null,
          city: null,
          language: null,
          source: 'web-extractor',
          sourceUrl: next.url,
          discoveredAt: new Date().toISOString(),
          raw: { title: page.title, artistName: page.artistName },
        })
      }

      if (next.depth < opts.maxDepth) {
        for (const link of page.links) {
          if (!visited.has(link)) queue.push({ url: link, depth: next.depth + 1 })
        }
      }
    } catch (err) {
      consecutiveErrors++
      pages.push({
        url: next.url,
        depth: next.depth,
        status: 'error',
        emailsFound: 0,
        error: (err as Error).message,
      })
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        aborted = true
        abortReason = `Aborted after ${consecutiveErrors} consecutive errors`
        break
      }
    }
  }

  logger.info(
    {
      startUrl: opts.startUrl,
      visited: visited.size,
      emails: results.length,
      aborted,
    },
    '[web-extractor] crawl finished',
  )

  return {
    visitedCount: visited.size,
    emailsCount: results.length,
    results,
    pages,
    aborted,
    ...(abortReason ? { abortReason } : {}),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
