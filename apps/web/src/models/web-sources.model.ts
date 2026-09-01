import type { DiscoverySource, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit.model'
import { persistResults, type RunReport } from './discovery.model'
import { crawlSite, type CrawlReport } from '@/services/discovery/web-extractor/crawler'
import { checkRobots, type RobotsCheckResult } from '@/services/discovery/web-extractor/robots'

// ────────────────────────────────────────────────────────────────
// Types + errors
// ────────────────────────────────────────────────────────────────

export interface CreateWebSourceInput {
  name: string
  url: string
  complianceNotes?: string
  termsUrl?: string
}

export interface VerifyWebSourceInput {
  authorizationRef: string
  complianceNotes: string
}

export interface ExtractOptions {
  maxPages?: number
  maxDepth?: number
  rateLimitMs?: number
}

export interface ExtractReport {
  run: RunReport['run']
  crawl: Omit<CrawlReport, 'results'>
  persisted: Omit<RunReport, 'run'>
}

export class WebSourceNotFoundError extends Error {
  constructor(id: string) {
    super(`Web source ${id} not found`)
    this.name = 'WebSourceNotFoundError'
  }
}

export class SourceNotVerifiedError extends Error {
  constructor() {
    super('Source is not verified; register the LOPD authorization before extracting')
    this.name = 'SourceNotVerifiedError'
  }
}

export class InvalidUrlError extends Error {
  constructor(url: string) {
    super(`Invalid URL: ${url}`)
    this.name = 'InvalidUrlError'
  }
}

// ────────────────────────────────────────────────────────────────
// Read
// ────────────────────────────────────────────────────────────────

export async function listWebSources(): Promise<DiscoverySource[]> {
  return prisma.discoverySource.findMany({
    where: { type: 'DIRECTORY' },
    orderBy: [{ complianceStatus: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getWebSource(id: string): Promise<DiscoverySource> {
  const source = await prisma.discoverySource.findUnique({ where: { id } })
  if (!source || source.type !== 'DIRECTORY') throw new WebSourceNotFoundError(id)
  return source
}

// ────────────────────────────────────────────────────────────────
// Create / verify / unverify / delete
// ────────────────────────────────────────────────────────────────

export async function createWebSource(
  input: CreateWebSourceInput,
  actorId: string,
): Promise<DiscoverySource> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(input.url)
  } catch {
    throw new InvalidUrlError(input.url)
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new InvalidUrlError(input.url)
  }

  const slug = deriveSlug(parsedUrl)

  return prisma.$transaction(async (tx) => {
    // Slug único: si existe, apéndamos sufijo timestamp corto.
    const finalSlug = (await tx.discoverySource.findUnique({ where: { slug } }))
      ? `${slug}-${Date.now().toString(36)}`
      : slug

    const source = await tx.discoverySource.create({
      data: {
        slug: finalSlug,
        name: input.name.trim(),
        type: 'DIRECTORY',
        complianceStatus: 'UNVERIFIED',
        ...(input.complianceNotes ? { complianceNotes: input.complianceNotes } : {}),
        ...(input.termsUrl ? { termsUrl: input.termsUrl } : {}),
        enabled: false,
        config: {
          startUrl: parsedUrl.toString(),
          host: parsedUrl.hostname,
        } as Prisma.InputJsonValue,
      },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'discovery_source',
        entityId: source.id,
        action: 'web_source_registered',
        after: {
          slug: source.slug,
          name: source.name,
          startUrl: parsedUrl.toString(),
          host: parsedUrl.hostname,
        },
      },
      tx,
    )

    return source
  })
}

export async function verifyWebSource(
  id: string,
  input: VerifyWebSourceInput,
  actorId: string,
): Promise<DiscoverySource> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.discoverySource.findUnique({ where: { id } })
    if (!source || source.type !== 'DIRECTORY') throw new WebSourceNotFoundError(id)

    const notes = [
      input.complianceNotes.trim(),
      `authorizationRef=${input.authorizationRef.trim()}`,
      `verifiedAt=${new Date().toISOString()}`,
      `verifiedBy=${actorId}`,
    ].join(' | ')

    const updated = await tx.discoverySource.update({
      where: { id },
      data: {
        complianceStatus: 'VERIFIED',
        complianceNotes: notes,
        enabled: true,
      },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'discovery_source',
        entityId: id,
        action: 'web_source_verified',
        before: {
          complianceStatus: source.complianceStatus,
          enabled: source.enabled,
        },
        after: {
          complianceStatus: 'VERIFIED',
          enabled: true,
          authorizationRef: input.authorizationRef,
        },
      },
      tx,
    )

    return updated
  })
}

export async function unverifyWebSource(
  id: string,
  reason: string,
  actorId: string,
): Promise<DiscoverySource> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.discoverySource.findUnique({ where: { id } })
    if (!source || source.type !== 'DIRECTORY') throw new WebSourceNotFoundError(id)

    const updated = await tx.discoverySource.update({
      where: { id },
      data: {
        complianceStatus: 'UNVERIFIED',
        enabled: false,
        complianceNotes: `Unverified: ${reason}`,
      },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'discovery_source',
        entityId: id,
        action: 'web_source_unverified',
        before: { complianceStatus: source.complianceStatus, enabled: source.enabled },
        after: { complianceStatus: 'UNVERIFIED', enabled: false },
        metadata: { reason },
      },
      tx,
    )

    return updated
  })
}

// ────────────────────────────────────────────────────────────────
// Check robots.txt en vivo
// ────────────────────────────────────────────────────────────────

export async function checkWebSourceRobots(id: string): Promise<RobotsCheckResult> {
  const source = await getWebSource(id)
  const config = source.config as { startUrl?: string }
  if (!config?.startUrl) throw new InvalidUrlError('missing startUrl')
  return checkRobots(config.startUrl)
}

// ────────────────────────────────────────────────────────────────
// Extract — corre crawl y persiste con el pipeline existente
// ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_PAGES = 50
const DEFAULT_MAX_DEPTH = 2

export async function extractFromWebSource(
  id: string,
  opts: ExtractOptions,
  actorId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractReport> {
  const source = await getWebSource(id)
  if (source.complianceStatus !== 'VERIFIED') {
    throw new SourceNotVerifiedError()
  }
  const config = source.config as { startUrl?: string }
  if (!config?.startUrl) throw new InvalidUrlError('missing startUrl')

  const run = await prisma.discoveryRun.create({
    data: {
      sourceId: source.id,
      params: {
        maxPages: opts.maxPages ?? DEFAULT_MAX_PAGES,
        maxDepth: opts.maxDepth ?? DEFAULT_MAX_DEPTH,
        startUrl: config.startUrl,
      } as Prisma.InputJsonValue,
      status: 'RUNNING',
      triggeredBy: actorId,
    },
  })

  try {
    const crawl = await crawlSite(
      {
        startUrl: config.startUrl,
        maxPages: opts.maxPages ?? DEFAULT_MAX_PAGES,
        maxDepth: opts.maxDepth ?? DEFAULT_MAX_DEPTH,
        ...(opts.rateLimitMs !== undefined ? { rateLimitMs: opts.rateLimitMs } : {}),
      },
      fetchImpl,
    )

    const persisted = await persistResults({
      runId: run.id,
      sourceId: source.id,
      results: crawl.results,
    })

    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: crawl.aborted ? 'FAILED' : 'SUCCEEDED',
        finishedAt: new Date(),
        resultsCount: persisted.resultsCount,
        newContactsCount: persisted.newContactsCount,
        ...(crawl.abortReason ? { error: crawl.abortReason } : {}),
      },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'discovery_run',
        entityId: run.id,
        action: 'web_extraction_finished',
        after: {
          source: source.slug,
          visitedPages: crawl.visitedCount,
          emailsFound: crawl.emailsCount,
          newContacts: persisted.newContactsCount,
          duplicates: persisted.duplicates.length,
          aborted: crawl.aborted,
        },
      },
    )

    const { results: _results, ...crawlSummary } = crawl
    return {
      run: await prisma.discoveryRun.findUniqueOrThrow({ where: { id: run.id } }),
      crawl: crawlSummary,
      persisted,
    }
  } catch (err) {
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: (err as Error).message,
      },
    })
    throw err
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function deriveSlug(url: URL): string {
  const host = url.hostname.replace(/^www\./, '').replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const path = url.pathname
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
  return path ? `web-${host}-${path}`.slice(0, 60) : `web-${host}`.slice(0, 60)
}
