import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import { commitCsvImport, previewCsvImport, runProvider } from './discovery.model'
import { addSuppression } from './suppressions.model'
import { musicbrainzProvider } from '@/services/discovery/providers/musicbrainz.provider'
import { ProviderNotVerifiedError } from '@/services/discovery/registry'

const ACTOR = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb'

describe('discovery.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  describe('previewCsvImport', () => {
    it('returns sniffed mapping and normalized rows without touching DB', () => {
      const csv = 'artist,email,country\nAna,ana@x.com,es\nBob,BOB@x.com,mx'
      const preview = previewCsvImport(csv)
      expect(preview.validRows).toBe(2)
      expect(preview.suggestedMapping.artistName).toBe('artist')
    })
  })

  describe('commitCsvImport', () => {
    it('creates contacts, contact_sources and audit', async () => {
      const csv = ['name,email,country', 'Ana Luz,ana@x.com,ES', 'Diego,diego@x.com,CL'].join('\n')
      const report = await commitCsvImport(
        { csvText: csv, mapping: { artistName: 'name', email: 'email', country: 'country' } },
        ACTOR,
      )
      expect(report.resultsCount).toBe(2)
      expect(report.newContactsCount).toBe(2)
      expect(await prisma.contact.count()).toBe(2)
      expect(await prisma.contactSource.count()).toBe(2)
      const audits = await prisma.auditLog.findMany({
        where: { entityType: 'contact', action: 'discovered' },
      })
      expect(audits).toHaveLength(2)
      const runAudit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'discovery_run', action: 'csv_imported' },
      })
      expect(runAudit.entityId).toBe(report.run.id)
    })

    it('dedupes on email and reports duplicates', async () => {
      await commitCsvImport(
        {
          csvText: 'name,email\nAna,dup@x.com',
          mapping: { artistName: 'name', email: 'email' },
        },
        ACTOR,
      )
      const report = await commitCsvImport(
        {
          csvText: 'name,email\nAna Repeated,DUP@x.com\nBob,new@x.com',
          mapping: { artistName: 'name', email: 'email' },
        },
        ACTOR,
      )
      expect(report.resultsCount).toBe(2)
      expect(report.newContactsCount).toBe(1)
      expect(report.duplicates).toHaveLength(1)
      expect(await prisma.contact.count()).toBe(2)
      // Existing contact accumulates a second contact_source.
      const existing = await prisma.contact.findUniqueOrThrow({ where: { email: 'dup@x.com' } })
      const sources = await prisma.contactSource.count({ where: { contactId: existing.id } })
      expect(sources).toBe(2)
    })

    it('auto-suppresses new contacts whose email is on the suppression list', async () => {
      await addSuppression({ email: 'banned@x.com', reason: 'MANUAL' }, ACTOR)
      const report = await commitCsvImport(
        {
          csvText: 'name,email\nBanned Artist,banned@x.com',
          mapping: { artistName: 'name', email: 'email' },
        },
        ACTOR,
      )
      expect(report.newContactsCount).toBe(1)
      expect(report.suppressed).toBe(1)
      const c = await prisma.contact.findUniqueOrThrow({ where: { email: 'banned@x.com' } })
      expect(c.contactStatus).toBe('SUPPRESSED')
      expect(c.permission).toBe('BLOCKED')
    })

    it('imports contacts without email as REVIEW_REQUIRED + NOT_FOUND', async () => {
      const report = await commitCsvImport(
        { csvText: 'name\nSin Email', mapping: { artistName: 'name' } },
        ACTOR,
      )
      expect(report.newContactsCount).toBe(1)
      const c = await prisma.contact.findFirstOrThrow({ where: { artistName: 'Sin Email' } })
      expect(c.email).toBeNull()
      expect(c.emailStatus).toBe('NOT_FOUND')
      expect(c.contactStatus).toBe('REVIEW_REQUIRED')
    })

    it('discovery_run captures success + counts', async () => {
      const report = await commitCsvImport(
        {
          csvText: 'name,email\nA,a@x.com\nB,b@x.com',
          mapping: { artistName: 'name', email: 'email' },
        },
        ACTOR,
      )
      const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: report.run.id } })
      expect(run.status).toBe('SUCCEEDED')
      expect(run.resultsCount).toBe(2)
      expect(run.newContactsCount).toBe(2)
      expect(run.triggeredBy).toBe(ACTOR)
      expect(run.finishedAt).not.toBeNull()
    })
  })

  describe('runProvider', () => {
    it('does not run PROHIBITED/UNVERIFIED providers', async () => {
      const spy = vi.spyOn(musicbrainzProvider, 'isCompliant').mockResolvedValueOnce({
        status: 'UNVERIFIED',
        checkedAt: new Date().toISOString(),
        notes: 'test',
      })
      await expect(
        runProvider(
          { sourceSlug: 'musicbrainz', params: { maxResults: 5 } },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(ProviderNotVerifiedError)
      // No discovery_run row created.
      expect(await prisma.discoveryRun.count()).toBe(0)
      spy.mockRestore()
    })

    it('runs a verified provider (mocked network) and persists results', async () => {
      const complianceSpy = vi.spyOn(musicbrainzProvider, 'isCompliant').mockResolvedValueOnce({
        status: 'VERIFIED',
        checkedAt: new Date().toISOString(),
      })
      const searchSpy = vi.spyOn(musicbrainzProvider, 'search').mockResolvedValueOnce([
        {
          artistName: 'Fake Artist',
          email: null,
          website: null,
          discipline: 'rock',
          country: 'ES',
          city: 'Madrid',
          language: null,
          source: 'musicbrainz',
          sourceUrl: 'https://musicbrainz.org/artist/fake',
          discoveredAt: new Date().toISOString(),
          raw: {},
        },
      ])

      const report = await runProvider(
        { sourceSlug: 'musicbrainz', params: { maxResults: 5 } },
        ACTOR,
      )
      expect(report.newContactsCount).toBe(1)
      expect(await prisma.contact.count()).toBe(1)
      const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: report.run.id } })
      expect(run.status).toBe('SUCCEEDED')

      complianceSpy.mockRestore()
      searchSpy.mockRestore()
    })

    it('marks run as FAILED and preserves the row if search throws', async () => {
      const complianceSpy = vi.spyOn(musicbrainzProvider, 'isCompliant').mockResolvedValueOnce({
        status: 'VERIFIED',
        checkedAt: new Date().toISOString(),
      })
      const searchSpy = vi.spyOn(musicbrainzProvider, 'search').mockRejectedValueOnce(
        new Error('MusicBrainz 503'),
      )
      await expect(
        runProvider({ sourceSlug: 'musicbrainz', params: { maxResults: 5 } }, ACTOR),
      ).rejects.toThrow(/503/)
      const runs = await prisma.discoveryRun.findMany()
      expect(runs).toHaveLength(1)
      expect(runs[0]?.status).toBe('FAILED')
      expect(runs[0]?.error).toMatch(/503/)
      complianceSpy.mockRestore()
      searchSpy.mockRestore()
    })
  })
})
