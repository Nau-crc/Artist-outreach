import type { Contact, DiscoveryRun, DiscoverySourceType, Prisma } from '@prisma/client'
import type {
  CsvColumnMapping,
  CsvPreviewResult,
  DiscoveryResult,
  DiscoverySearchParams,
} from '@artist-outreach/shared'
import { prisma } from '@/lib/prisma'
import { getVerifiedProvider, listProviders } from '@/services/discovery/registry'
import { parseCsvToResults, previewCsv } from '@/services/discovery/providers/csv-import.provider'
import { writeAudit } from './audit.model'
import { isSuppressed } from './suppressions.model'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface RunReport {
  run: DiscoveryRun
  resultsCount: number
  newContactsCount: number
  duplicates: Array<{ artistName: string; existingId: string }>
  suppressed: number
}

export interface RunProviderInput {
  sourceSlug: string
  params: DiscoverySearchParams
}

export interface RunCsvInput {
  csvText: string
  mapping: CsvColumnMapping
}

export class UnknownProviderError extends Error {
  constructor(slug: string) {
    super(`Unknown discovery provider: ${slug}`)
    this.name = 'UnknownProviderError'
  }
}

// ────────────────────────────────────────────────────────────────
// Listing helpers
// ────────────────────────────────────────────────────────────────

export interface RegistryEntry {
  slug: string
  name: string
  type: DiscoverySourceType
  requiresApiKey: boolean
  compliance: { status: string; notes?: string; checkedAt: string }
}

export async function listDiscoverySources(): Promise<RegistryEntry[]> {
  const providers = listProviders()
  const out: RegistryEntry[] = []
  for (const p of providers) {
    const c = await p.isCompliant()
    out.push({
      slug: p.slug,
      name: p.name,
      type: p.type,
      requiresApiKey: p.requiresApiKey,
      compliance: {
        status: c.status,
        ...(c.notes !== undefined ? { notes: c.notes } : {}),
        checkedAt: c.checkedAt,
      },
    })
  }
  return out
}

export async function listDiscoveryRuns(limit = 50): Promise<DiscoveryRun[]> {
  return prisma.discoveryRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: Math.min(limit, 200),
    include: { source: { select: { slug: true, name: true } } },
  })
}

// ────────────────────────────────────────────────────────────────
// CSV preview
// ────────────────────────────────────────────────────────────────

export function previewCsvImport(
  csvText: string,
  mapping?: Partial<CsvColumnMapping>,
): CsvPreviewResult {
  return previewCsv(csvText, mapping)
}

// ────────────────────────────────────────────────────────────────
// Provider runs (API)
// ────────────────────────────────────────────────────────────────

export async function runProvider(input: RunProviderInput, actorId: string): Promise<RunReport> {
  const provider = await getVerifiedProvider(input.sourceSlug)
  const source = await ensureSourceRow(provider.slug, provider.name, provider.type)

  const run = await prisma.discoveryRun.create({
    data: {
      sourceId: source.id,
      params: input.params as unknown as Prisma.InputJsonValue,
      status: 'RUNNING',
      triggeredBy: actorId,
    },
  })

  try {
    const results = await provider.search(input.params)
    const report = await persistResults({
      runId: run.id,
      sourceId: source.id,
      results,
    })
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        finishedAt: new Date(),
        resultsCount: report.resultsCount,
        newContactsCount: report.newContactsCount,
      },
    })
    await writeAudit({
      actorId,
      actorKind: 'USER',
      entityType: 'discovery_run',
      entityId: run.id,
      action: 'run_finished',
      after: {
        source: provider.slug,
        results: report.resultsCount,
        new: report.newContactsCount,
        suppressed: report.suppressed,
        duplicates: report.duplicates.length,
      },
    })
    return { ...report, run: await prisma.discoveryRun.findUniqueOrThrow({ where: { id: run.id } }) }
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
// CSV commit
// ────────────────────────────────────────────────────────────────

export async function commitCsvImport(input: RunCsvInput, actorId: string): Promise<RunReport> {
  const provider = await getVerifiedProvider('csv-import')
  const source = await ensureSourceRow(provider.slug, provider.name, provider.type)

  const results = parseCsvToResults(input.csvText, input.mapping)

  const run = await prisma.discoveryRun.create({
    data: {
      sourceId: source.id,
      params: {
        mapping: input.mapping,
        totalRows: results.length,
      } as unknown as Prisma.InputJsonValue,
      status: 'RUNNING',
      triggeredBy: actorId,
    },
  })

  try {
    const report = await persistResults({
      runId: run.id,
      sourceId: source.id,
      results,
    })
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        finishedAt: new Date(),
        resultsCount: report.resultsCount,
        newContactsCount: report.newContactsCount,
      },
    })
    await writeAudit({
      actorId,
      actorKind: 'USER',
      entityType: 'discovery_run',
      entityId: run.id,
      action: 'csv_imported',
      after: {
        results: report.resultsCount,
        new: report.newContactsCount,
        suppressed: report.suppressed,
        duplicates: report.duplicates.length,
      },
    })
    return { ...report, run: await prisma.discoveryRun.findUniqueOrThrow({ where: { id: run.id } }) }
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
// Persist pipeline
// ────────────────────────────────────────────────────────────────

interface PersistParams {
  runId: string
  sourceId: string
  results: DiscoveryResult[]
}

async function persistResults(params: PersistParams): Promise<Omit<RunReport, 'run'>> {
  const { runId, sourceId, results } = params
  const duplicates: RunReport['duplicates'] = []
  let created = 0
  let suppressedCount = 0

  for (const result of results) {
    const email = result.email ?? null
    const wasSuppressed = email ? await isSuppressed(email) : false

    const existing = email
      ? await prisma.contact.findUnique({ where: { email } })
      : null

    let contactId: string
    if (existing) {
      duplicates.push({ artistName: result.artistName, existingId: existing.id })
      contactId = existing.id
    } else {
      const contact = await prisma.contact.create({
        data: {
          artistName: result.artistName,
          email,
          website: result.website ?? null,
          discipline: result.discipline ?? null,
          country: result.country ?? null,
          city: result.city ?? null,
          language: result.language ?? null,
          contactStatus: wasSuppressed ? 'SUPPRESSED' : 'REVIEW_REQUIRED',
          emailStatus: email ? 'FOUND' : 'NOT_FOUND',
          permission: wasSuppressed ? 'BLOCKED' : 'NOT_REVIEWED',
        },
      })
      contactId = contact.id
      created++
      if (wasSuppressed) suppressedCount++
      await writeAudit({
        actorId: null,
        actorKind: 'SYSTEM',
        entityType: 'contact',
        entityId: contact.id,
        action: 'discovered',
        after: {
          artistName: contact.artistName,
          email: contact.email,
          source: result.source,
          sourceUrl: result.sourceUrl,
        },
        metadata: { runId, autoSuppressed: wasSuppressed || undefined },
      })
    }

    await prisma.contactSource.create({
      data: {
        contactId,
        runId,
        sourceId,
        sourceUrl: result.sourceUrl,
        raw: (result.raw ?? {}) as Prisma.InputJsonValue,
      },
    })
  }

  return {
    resultsCount: results.length,
    newContactsCount: created,
    duplicates,
    suppressed: suppressedCount,
  }
}

// ────────────────────────────────────────────────────────────────
// Source row management
// ────────────────────────────────────────────────────────────────

async function ensureSourceRow(
  slug: string,
  name: string,
  type: DiscoverySourceType,
): Promise<{ id: string }> {
  return prisma.discoverySource.upsert({
    where: { slug },
    update: { name },
    create: {
      slug,
      name,
      type,
      complianceStatus: 'VERIFIED',
      enabled: true,
    },
    select: { id: true },
  })
}

// Also expose Contact for callers that need to disambiguate types.
export type { Contact }
