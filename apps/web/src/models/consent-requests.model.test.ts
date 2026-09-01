import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import {
  CooldownActiveError,
  DuplicateRequestError,
  TemplateInactiveError,
  cancelConsentRequest,
  enqueueConsentRequest,
  listConsentRequests,
  processQueue,
  simulateEligibility,
} from './consent-requests.model'
import { addSuppression } from './suppressions.model'
import { updateConfig } from './config.model'

const ACTOR = 'dddddddd-1111-2222-3333-dddddddddddd'

async function seed() {
  const template = await prisma.consentTemplate.create({
    data: {
      name: 't1',
      subject: 'Hola {{ artistName }}',
      bodyHtml: '<p>{{ confirmUrl }}</p>',
      bodyText: '{{ confirmUrl }}',
    },
  })
  const campaign = await prisma.campaign.create({
    data: { name: 'c1', active: true },
  })
  const contact = await prisma.contact.create({
    data: {
      artistName: 'Ana',
      email: 'ana@x.com',
      contactStatus: 'REVIEWED',
      emailStatus: 'FOUND',
      permission: 'ELIGIBLE',
      consentStatus: 'UNKNOWN',
    },
  })
  return { template, campaign, contact }
}

describe('consent-requests.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ────────────────────────────────────────────────────────────────
  // enqueue
  // ────────────────────────────────────────────────────────────────

  describe('enqueueConsentRequest', () => {
    it('happy path — crea consent_request PENDING, marca contact REQUESTED, audita', async () => {
      const { template, campaign, contact } = await seed()
      const result = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      expect(result.status).toBe('ENQUEUED')
      expect(result.request?.status).toBe('PENDING')
      expect(result.request?.token).toBeTruthy()
      expect(result.request?.tokenExpiresAt).not.toBeNull()

      const contactAfter = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
      expect(contactAfter.consentStatus).toBe('REQUESTED')

      const audits = await prisma.auditLog.findMany({ orderBy: { at: 'asc' } })
      const actions = audits.map((a) => `${a.entityType}:${a.action}`)
      expect(actions).toContain('consent_request:enqueued')
      expect(actions).toContain('contact:consent_requested')
    })

    it('snapshot text_version incluye version + subject + hash', async () => {
      const { template, campaign, contact } = await seed()
      const r = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const snap = JSON.parse(r.request!.textVersion)
      expect(snap.version).toBe(template.version)
      expect(snap.subject).toBe(template.subject)
      expect(snap.text).toBe(template.bodyText)
      expect(snap.htmlHash).toBeTruthy()
    })

    it('rechaza si template está inactivo', async () => {
      const { template, campaign, contact } = await seed()
      await prisma.consentTemplate.update({ where: { id: template.id }, data: { active: false } })
      await expect(
        enqueueConsentRequest(
          { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(TemplateInactiveError)
    })

    it('NOT_ELIGIBLE si la campaña está inactiva', async () => {
      const { template, campaign, contact } = await seed()
      await prisma.campaign.update({ where: { id: campaign.id }, data: { active: false } })
      const result = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      expect(result.status).toBe('NOT_ELIGIBLE')
      expect(result.reasons).toContain('campaign_inactive')
      // Nada creado.
      expect(await prisma.consentRequest.count()).toBe(0)
    })

    it('NOT_ELIGIBLE si el email está suprimido', async () => {
      const { template, campaign, contact } = await seed()
      await addSuppression({ email: 'ana@x.com', reason: 'MANUAL' }, ACTOR)
      const contactAfter = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
      // La suppression cascade puso contactStatus=SUPPRESSED. Restauro
      // manualmente para probar sólo el bloqueo por suppression del motor.
      await prisma.contact.update({
        where: { id: contactAfter.id },
        data: { contactStatus: 'REVIEWED', permission: 'ELIGIBLE' },
      })
      const result = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      expect(result.status).toBe('NOT_ELIGIBLE')
      expect(result.reasons).toContain('not_suppressed')
    })

    it('rechaza duplicate PENDING con DuplicateRequestError', async () => {
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      // Segundo enqueue: contact ya está en REQUESTED → falla por
      // cooldown antes de llegar al dedupe. Reseteo estado para forzar dedupe.
      await prisma.contact.update({
        where: { id: contact.id },
        data: { consentStatus: 'UNKNOWN' },
      })
      // Y adelanto el cooldown al pasado.
      await prisma.consentRequest.updateMany({
        where: {},
        data: { createdAt: new Date(Date.now() - 200 * 86_400_000) },
      })
      await expect(
        enqueueConsentRequest(
          { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(DuplicateRequestError)
    })

    it('rechaza si cooldown activo', async () => {
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      // El contact ahora está REQUESTED. Lo reseteo para que el motor no bloquee
      // por consent_status, y así probemos SOLO el cooldown.
      await prisma.contact.update({
        where: { id: contact.id },
        data: { consentStatus: 'UNKNOWN' },
      })
      await expect(
        enqueueConsentRequest(
          { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(CooldownActiveError)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // list + cancel
  // ────────────────────────────────────────────────────────────────

  describe('list + cancel', () => {
    it('list filtra por status', async () => {
      const { template, campaign, contact } = await seed()
      const r = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const pending = await listConsentRequests({ status: 'PENDING' })
      expect(pending).toHaveLength(1)
      await cancelConsentRequest(r.request!.id, ACTOR)
      const cancelled = await listConsentRequests({ status: 'CANCELLED' })
      expect(cancelled).toHaveLength(1)
    })

    it('cancel solo PENDING', async () => {
      const { template, campaign, contact } = await seed()
      const r = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      await cancelConsentRequest(r.request!.id, ACTOR)
      await expect(cancelConsentRequest(r.request!.id, ACTOR)).rejects.toThrow(/Cannot cancel/)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // simulate
  // ────────────────────────────────────────────────────────────────

  describe('simulateEligibility', () => {
    it('cuenta eligible / notEligible y devuelve breakdown', async () => {
      // 2 elegibles + 1 sin email + 1 suprimido.
      for (let i = 0; i < 2; i++) {
        await prisma.contact.create({
          data: {
            artistName: `A${i}`,
            email: `a${i}@x.com`,
            contactStatus: 'REVIEWED',
            emailStatus: 'FOUND',
            permission: 'ELIGIBLE',
            consentStatus: 'UNKNOWN',
          },
        })
      }
      // Este será excluido en el WHERE del sim (no tiene email).
      await prisma.contact.create({
        data: {
          artistName: 'NoEmail',
          contactStatus: 'REVIEWED',
          emailStatus: 'NOT_FOUND',
          permission: 'ELIGIBLE',
          consentStatus: 'UNKNOWN',
        },
      })
      // Con email pero suprimido.
      const withEmail = await prisma.contact.create({
        data: {
          artistName: 'Supp',
          email: 'supp@x.com',
          contactStatus: 'REVIEWED',
          emailStatus: 'FOUND',
          permission: 'ELIGIBLE',
          consentStatus: 'UNKNOWN',
        },
      })
      await addSuppression({ email: 'supp@x.com', reason: 'MANUAL' }, ACTOR)
      // Restauro para que entre en el WHERE.
      await prisma.contact.update({
        where: { id: withEmail.id },
        data: { contactStatus: 'REVIEWED', permission: 'ELIGIBLE' },
      })

      const sim = await simulateEligibility({ limit: 100 })
      expect(sim.totalEvaluated).toBe(3)
      expect(sim.eligible).toBe(2)
      expect(sim.notEligible).toBe(1)
      expect(sim.suppressed).toBe(1)
      expect(sim.reasonsBreakdown.not_suppressed).toBe(1)
      expect(sim.sample).toHaveLength(3)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Worker esqueleto — CRÍTICO: no envía en fase 5.
  // ────────────────────────────────────────────────────────────────

  describe('processQueue (fase 5 — no-op)', () => {
    it('skipped=sending_disabled cuando sending_enabled=false', async () => {
      const r = await processQueue()
      expect(r.processed).toBe(0)
      expect(r.skipped).toBe(true)
      expect(r.reason).toBe('sending_disabled')
    })

    it('skipped=phase5_no_sending cuando sending_enabled=true y NO envía nada', async () => {
      await updateConfig({ dailySendLimit: 10 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      // Encolamos una request para que haya trabajo pendiente.
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const emailCountBefore = await prisma.emailMessage.count({
        where: { purpose: 'CONSENT_REQUEST' },
      })
      const r = await processQueue()
      expect(r.processed).toBe(0)
      expect(r.skipped).toBe(true)
      expect(r.reason).toBe('phase5_no_sending')
      // Verificación explícita: NO se creó ningún email_message con purpose=CONSENT_REQUEST.
      const emailCountAfter = await prisma.emailMessage.count({
        where: { purpose: 'CONSENT_REQUEST' },
      })
      expect(emailCountAfter).toBe(emailCountBefore)
    })
  })
})
