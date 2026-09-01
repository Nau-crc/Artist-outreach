import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import {
  TemplateInUseError,
  TemplateNotFoundError,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  renderTemplate,
  updateTemplate,
} from './templates.model'

const ACTOR = 'ffffffff-1111-2222-3333-ffffffffffff'

const seed = () =>
  createTemplate(
    {
      name: 'Solicitud v1',
      subject: 'Hola {{ artistName }}',
      bodyHtml: '<p>Hola {{ artistName }}. Confirma: {{ confirmUrl }}</p>',
      bodyText: 'Hola {{ artistName }}. Confirma: {{ confirmUrl }}',
    },
    ACTOR,
  )

describe('templates.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  describe('create + list + get', () => {
    it('creates with version=1, active=true by default, writes audit', async () => {
      const t = await seed()
      expect(t.version).toBe(1)
      expect(t.active).toBe(true)
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'consent_template', action: 'created' },
      })
      expect(audit.entityId).toBe(t.id)
    })

    it('list respects active filter and sorts active first', async () => {
      const a = await seed()
      const b = await createTemplate(
        { name: 'Inactive', subject: 's', bodyHtml: 'x', bodyText: 'x', active: false },
        ACTOR,
      )
      const all = await listTemplates()
      expect(all.map((t) => t.id)).toEqual([a.id, b.id])
      const only = await listTemplates({ active: true })
      expect(only).toHaveLength(1)
      expect(only[0]?.id).toBe(a.id)
    })

    it('get throws NotFound for unknown id', async () => {
      await expect(getTemplate('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
        TemplateNotFoundError,
      )
    })
  })

  describe('update', () => {
    it('bumps version when subject/body changes, not when only name changes', async () => {
      const t = await seed()
      const renamed = await updateTemplate(t.id, { name: 'Nuevo nombre' }, ACTOR)
      expect(renamed.version).toBe(1)

      const bumped = await updateTemplate(t.id, { subject: 'Otro subject' }, ACTOR)
      expect(bumped.version).toBe(2)

      const bumpedAgain = await updateTemplate(t.id, { bodyText: 'Texto nuevo' }, ACTOR)
      expect(bumpedAgain.version).toBe(3)
    })

    it('audit action distinguishes content_updated vs updated', async () => {
      const t = await seed()
      await updateTemplate(t.id, { name: 'x' }, ACTOR)
      await updateTemplate(t.id, { subject: 'y' }, ACTOR)
      const actions = (
        await prisma.auditLog.findMany({
          where: { entityType: 'consent_template', entityId: t.id, action: { in: ['updated', 'content_updated'] } },
          orderBy: { at: 'asc' },
        })
      ).map((a) => a.action)
      expect(actions).toEqual(['updated', 'content_updated'])
    })

    it('no-op patch does not write audit or bump version', async () => {
      const t = await seed()
      await prisma.auditLog.deleteMany()
      await updateTemplate(t.id, {}, ACTOR)
      expect(await prisma.auditLog.count()).toBe(0)
      const same = await getTemplate(t.id)
      expect(same.version).toBe(t.version)
    })

    it('rejects unknown id', async () => {
      await expect(
        updateTemplate('00000000-0000-0000-0000-000000000000', { name: 'x' }, ACTOR),
      ).rejects.toBeInstanceOf(TemplateNotFoundError)
    })
  })

  describe('delete', () => {
    it('deletes and audits', async () => {
      const t = await seed()
      await deleteTemplate(t.id, ACTOR)
      expect(await prisma.consentTemplate.count()).toBe(0)
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'consent_template', action: 'deleted' },
      })
      expect(audit.entityId).toBe(t.id)
    })

    it('rejects if template is in use by consent_requests', async () => {
      const t = await seed()
      const campaign = await prisma.campaign.create({ data: { name: 'C', active: false } })
      const contact = await prisma.contact.create({
        data: {
          artistName: 'A',
          email: 'a@x.com',
          contactStatus: 'REVIEWED',
          emailStatus: 'FOUND',
          permission: 'ELIGIBLE',
        },
      })
      await prisma.consentRequest.create({
        data: {
          contactId: contact.id,
          campaignId: campaign.id,
          templateId: t.id,
          textVersion: 'snap',
          token: 'tok-1234567890abcdef',
        },
      })
      await expect(deleteTemplate(t.id, ACTOR)).rejects.toBeInstanceOf(TemplateInUseError)
    })
  })

  describe('renderTemplate', () => {
    it('applies variables', async () => {
      const t = await seed()
      const r = await renderTemplate(t.id, {
        artistName: 'Ana',
        confirmUrl: 'https://example.com/c/TOK',
      })
      expect(r.subject).toBe('Hola Ana')
      expect(r.html).toContain('Ana')
      expect(r.html).toContain('https://example.com/c/TOK')
      expect(r.version).toBe(1)
    })

    it('uses placeholders when variables missing', async () => {
      const t = await seed()
      const r = await renderTemplate(t.id, {})
      expect(r.subject).toContain('Nombre del artista')
    })
  })
})
