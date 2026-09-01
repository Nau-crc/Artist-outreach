import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import {
  InvalidUrlError,
  SourceNotVerifiedError,
  WebSourceNotFoundError,
  createWebSource,
  extractFromWebSource,
  getWebSource,
  listWebSources,
  unverifyWebSource,
  verifyWebSource,
} from './web-sources.model'
import { clearRobotsCacheForTests } from '@/services/discovery/web-extractor/robots'

const ACTOR = 'aaaaaaaa-1111-2222-3333-111111111111'

function fakeFetch(map: Record<string, { status?: number; contentType?: string; body?: string }>): typeof fetch {
  return vi.fn(async (url: string) => {
    const page = map[String(url)]
    if (!page) return new Response('', { status: 404 })
    return new Response(page.body ?? '', {
      status: page.status ?? 200,
      headers: { 'content-type': page.contentType ?? 'text/html' },
    })
  }) as unknown as typeof fetch
}

describe('web-sources.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
    clearRobotsCacheForTests()
  })

  afterAll(async () => {
    await disconnect()
  })

  describe('createWebSource', () => {
    it('crea UNVERIFIED por defecto, enabled=false, guarda config.startUrl', async () => {
      const s = await createWebSource(
        { name: 'Entidad X', url: 'https://entidad-x.example/artistas' },
        ACTOR,
      )
      expect(s.complianceStatus).toBe('UNVERIFIED')
      expect(s.enabled).toBe(false)
      const config = s.config as { startUrl: string; host: string }
      expect(config.startUrl).toBe('https://entidad-x.example/artistas')
      expect(config.host).toBe('entidad-x.example')
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'web_source_registered' },
      })
      expect(audit.entityId).toBe(s.id)
    })

    it('rechaza URLs inválidas', async () => {
      await expect(createWebSource({ name: 'X', url: 'not-a-url' }, ACTOR)).rejects.toBeInstanceOf(
        InvalidUrlError,
      )
    })

    it('rechaza protocolos no http/https', async () => {
      await expect(
        createWebSource({ name: 'X', url: 'ftp://x.com/y' }, ACTOR),
      ).rejects.toBeInstanceOf(InvalidUrlError)
    })
  })

  describe('verify / unverify', () => {
    it('verify → VERIFIED, enabled=true, notas con authorizationRef', async () => {
      const s = await createWebSource({ name: 'X', url: 'https://x.example/' }, ACTOR)
      const v = await verifyWebSource(
        s.id,
        { authorizationRef: 'contrato-001', complianceNotes: 'confirmado por email 2026-09-01' },
        ACTOR,
      )
      expect(v.complianceStatus).toBe('VERIFIED')
      expect(v.enabled).toBe(true)
      expect(v.complianceNotes).toContain('authorizationRef=contrato-001')
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'web_source_verified' },
      })
      expect(audit.entityId).toBe(s.id)
    })

    it('unverify → UNVERIFIED, enabled=false', async () => {
      const s = await createWebSource({ name: 'X', url: 'https://x.example/' }, ACTOR)
      await verifyWebSource(s.id, { authorizationRef: 'r', complianceNotes: 'n' }, ACTOR)
      const un = await unverifyWebSource(s.id, 'contrato caducado', ACTOR)
      expect(un.complianceStatus).toBe('UNVERIFIED')
      expect(un.enabled).toBe(false)
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'web_source_unverified' },
      })
      expect((audit.metadata as { reason: string }).reason).toBe('contrato caducado')
    })
  })

  describe('list / get', () => {
    it('list solo devuelve type=DIRECTORY', async () => {
      await createWebSource({ name: 'X', url: 'https://x.example/' }, ACTOR)
      // Otro tipo no debería aparecer.
      await prisma.discoverySource.create({
        data: { slug: 'other', name: 'Other', type: 'CSV' },
      })
      const list = await listWebSources()
      expect(list).toHaveLength(1)
      expect(list[0]?.type).toBe('DIRECTORY')
    })

    it('get NotFound si el id no es DIRECTORY', async () => {
      const other = await prisma.discoverySource.create({
        data: { slug: 'other2', name: 'Other', type: 'CSV' },
      })
      await expect(getWebSource(other.id)).rejects.toBeInstanceOf(WebSourceNotFoundError)
    })
  })

  describe('extractFromWebSource', () => {
    it('bloquea si el source no está VERIFIED', async () => {
      const s = await createWebSource({ name: 'X', url: 'https://x.example/' }, ACTOR)
      await expect(extractFromWebSource(s.id, {}, ACTOR)).rejects.toBeInstanceOf(
        SourceNotVerifiedError,
      )
      // No debe crear discovery_run.
      expect(await prisma.discoveryRun.count()).toBe(0)
    })

    it('happy path — crawl + persist contacts + audit', async () => {
      const s = await createWebSource({ name: 'Y', url: 'https://y.example/' }, ACTOR)
      await verifyWebSource(s.id, { authorizationRef: 'r', complianceNotes: 'n' }, ACTOR)

      const pages = {
        'https://y.example/robots.txt': { status: 404 },
        'https://y.example/': {
          body: '<a href="/a">a</a><a href="/b">b</a>',
        },
        'https://y.example/a': {
          body: '<h1>Ana Luz</h1><p><a href="mailto:ana@y.example">ana</a></p>',
        },
        'https://y.example/b': {
          body: '<h1>Bob</h1><p>bob@y.example</p>',
        },
      }

      const report = await extractFromWebSource(
        s.id,
        { maxPages: 10, maxDepth: 1, rateLimitMs: 0 },
        ACTOR,
        fakeFetch(pages),
      )

      expect(report.persisted.resultsCount).toBe(2)
      expect(report.persisted.newContactsCount).toBe(2)
      expect(report.crawl.visitedCount).toBeGreaterThanOrEqual(3)
      expect(report.run.status).toBe('SUCCEEDED')

      const contacts = await prisma.contact.findMany({ orderBy: { artistName: 'asc' } })
      expect(contacts.map((c) => c.artistName)).toEqual(['Ana Luz', 'Bob'])
      // Los nuevos contactos aterrizan en REVIEW_REQUIRED — nunca se envía nada
      // sin revisión humana explícita.
      expect(contacts.every((c) => c.contactStatus === 'REVIEW_REQUIRED')).toBe(true)

      const runAudit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'web_extraction_finished' },
      })
      expect(runAudit.entityId).toBe(report.run.id)
    })
  })
})
