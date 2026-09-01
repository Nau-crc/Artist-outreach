import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import {
  CooldownActiveError,
  DuplicateRequestError,
  TemplateInactiveError,
  acceptConsentRequest,
  cancelConsentRequest,
  declineConsentRequest,
  enqueueConsentRequest,
  listConsentRequests,
  processQueue,
  simulateEligibility,
} from './consent-requests.model'
import { addSuppression } from './suppressions.model'
import { updateConfig } from './config.model'
import { resetEmailProviderForTests } from '@/services/email/factory'
import { createFakeProvider } from '@/services/email/fake.provider'

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

    it('snapshot text_version incluye version + subject + text + html completos', async () => {
      const { template, campaign, contact } = await seed()
      const r = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const snap = JSON.parse(r.request!.textVersion)
      expect(snap.version).toBe(template.version)
      expect(snap.subject).toBe(template.subject)
      expect(snap.text).toBe(template.bodyText)
      expect(snap.html).toBe(template.bodyHtml)
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

  describe('processQueue (fase 6 — envío real detrás del gate)', () => {
    beforeEach(() => {
      resetEmailProviderForTests(createFakeProvider())
    })

    it('skipped=sending_disabled cuando sending_enabled=false', async () => {
      const r = await processQueue()
      expect(r.processed).toBe(0)
      expect(r.skipped).toBe(true)
      expect(r.reason).toBe('sending_disabled')
    })

    it('happy path: envía y marca SENT + sentAt + contact.consentStatus=REQUESTED', async () => {
      await updateConfig({ dailySendLimit: 10, hourlySendLimit: 10, minIntervalSeconds: 0 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      const { template, campaign, contact } = await seed()
      const enq = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      // enqueue ya puso el contact en REQUESTED. Volvemos a UNKNOWN para
      // simular una llamada donde el worker es el que hace la transición.
      // (Alternativamente, sendOne acepta REQUESTED también.)
      const r = await processQueue()
      expect(r.processed).toBe(1)
      expect(r.sent).toBe(1)
      expect(r.failed).toBe(0)

      const updated = await prisma.consentRequest.findUniqueOrThrow({
        where: { id: enq.request!.id },
      })
      expect(updated.status).toBe('SENT')
      expect(updated.sentAt).not.toBeNull()

      const msg = await prisma.emailMessage.findFirstOrThrow({
        where: { purpose: 'CONSENT_REQUEST' },
      })
      expect(msg.status).toBe('SENT')
      expect(msg.recipient).toBe('ana@x.com')
    })

    it('rate_limited cuando daily/hourly ya se han alcanzado', async () => {
      await updateConfig({ dailySendLimit: 1, hourlySendLimit: 10, minIntervalSeconds: 0 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      // Envío 1: pasa.
      await processQueue()
      // Encolamos otro (dedupe no aplica: nuevo contact).
      const c2 = await prisma.contact.create({
        data: {
          artistName: 'Bob',
          email: 'bob@x.com',
          contactStatus: 'REVIEWED',
          emailStatus: 'FOUND',
          permission: 'ELIGIBLE',
          consentStatus: 'UNKNOWN',
        },
      })
      await enqueueConsentRequest(
        { contactId: c2.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const r = await processQueue()
      expect(r.processed).toBe(0)
      expect(r.skipped).toBe(true)
      expect(r.reason).toMatch(/^rate_limited/)
    })

    it('pre-check FAILED: contact suprimido después de encolar', async () => {
      await updateConfig({ dailySendLimit: 10, hourlySendLimit: 10, minIntervalSeconds: 0 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      const { template, campaign, contact } = await seed()
      const enq = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      // Suprimimos el email antes de que el worker corra.
      await addSuppression({ email: 'ana@x.com', reason: 'MANUAL' }, ACTOR)
      const r = await processQueue()
      expect(r.sent).toBe(0)
      expect(r.failed).toBe(1)
      expect(r.results[0]?.reason).toBe('suppressed')
      const req = await prisma.consentRequest.findUniqueOrThrow({ where: { id: enq.request!.id } })
      expect(req.status).toBe('FAILED')
    })

    it('pre-check FAILED: campaign desactivada después de encolar', async () => {
      await updateConfig({ dailySendLimit: 10, hourlySendLimit: 10, minIntervalSeconds: 0 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      await prisma.campaign.update({ where: { id: campaign.id }, data: { active: false } })
      const r = await processQueue()
      expect(r.sent).toBe(0)
      expect(r.results[0]?.reason).toBe('campaign_inactive')
    })

    it('auto-pausa por bounce rate y aborta el batch', async () => {
      await updateConfig(
        { dailySendLimit: 100, hourlySendLimit: 100, minIntervalSeconds: 0, bounceRateMinSample: 2, bounceRateThresholdPct: 20 },
        ACTOR,
      )
      await updateConfig({ sendingEnabled: true }, ACTOR)
      // Simulamos historial: 4 SENT en las últimas 24h, 2 con BOUNCED = 50% > 20%.
      for (let i = 0; i < 4; i++) {
        const msg = await prisma.emailMessage.create({
          data: {
            purpose: 'CONSENT_REQUEST',
            provider: 'fake',
            providerMessageId: `msg-${i}`,
            recipient: `x${i}@y.com`,
            status: 'SENT',
            sentAt: new Date(Date.now() - 1000 * 60 * 60), // hace 1h
          },
        })
        if (i < 2) {
          await prisma.emailEvent.create({
            data: {
              messageId: msg.id,
              eventType: 'BOUNCED',
              providerEventId: `evt-${i}`,
            },
          })
        }
      }
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const r = await processQueue()
      expect(r.autoPaused).toBe(true)
      expect(r.reason).toBe('auto_paused_bounce_rate')
      // sending_enabled debe haber sido revertido a false por el auto-pause.
      const cfg = await prisma.appConfig.findUniqueOrThrow({ where: { id: 1 } })
      expect(cfg.sendingEnabled).toBe(false)
      expect(cfg.autoPausedReason).toContain('bounce_rate=')
    })

    it('accept crea Consent CONFIRMED + actualiza contact + audit', async () => {
      const { template, campaign, contact } = await seed()
      const enq = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const r = await acceptConsentRequest(enq.request!.token)
      expect(r.status).toBe('accepted')
      expect(r.contactId).toBe(contact.id)
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
      expect(c.consentStatus).toBe('CONFIRMED')
      const consent = await prisma.consent.findFirstOrThrow({ where: { contactId: contact.id } })
      expect(consent.status).toBe('CONFIRMED')
      expect(consent.source).toBe('EMAIL_LINK')
      expect(consent.textVersion).toBe(enq.request!.textVersion)
    })

    it('accept es idempotente (already_answered la segunda vez)', async () => {
      const { template, campaign, contact } = await seed()
      const enq = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      await acceptConsentRequest(enq.request!.token)
      const r = await acceptConsentRequest(enq.request!.token)
      expect(r.status).toBe('already_answered')
      expect(await prisma.consent.count()).toBe(1)
    })

    it('accept invalid con token desconocido', async () => {
      const r = await acceptConsentRequest('tok-que-no-existe-000000')
      expect(r.status).toBe('invalid')
    })

    it('decline crea Consent WITHDRAWN + suprime email + cascadea', async () => {
      const { template, campaign, contact } = await seed()
      const enq = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const r = await declineConsentRequest(enq.request!.token)
      expect(r.status).toBe('declined')
      const supp = await prisma.suppression.findFirstOrThrow({ where: { email: 'ana@x.com' } })
      expect(supp.reason).toBe('WITHDRAWN')
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })
      expect(c.consentStatus).toBe('WITHDRAWN')
      expect(c.contactStatus).toBe('SUPPRESSED')
    })

    it('decline es idempotente', async () => {
      const { template, campaign, contact } = await seed()
      const enq = await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      await declineConsentRequest(enq.request!.token)
      const r = await declineConsentRequest(enq.request!.token)
      expect(r.status).toBe('already_answered')
    })

    it('bounce rate no dispara auto-pausa si sample < minSample', async () => {
      await updateConfig(
        { dailySendLimit: 10, hourlySendLimit: 10, minIntervalSeconds: 0, bounceRateMinSample: 10, bounceRateThresholdPct: 5 },
        ACTOR,
      )
      await updateConfig({ sendingEnabled: true }, ACTOR)
      // Solo 1 SENT con 1 BOUNCED en la ventana: 100% pero sample < 10.
      const msg = await prisma.emailMessage.create({
        data: {
          purpose: 'CONSENT_REQUEST',
          provider: 'fake',
          providerMessageId: 'onlymsg',
          recipient: 'x@y.com',
          status: 'SENT',
          sentAt: new Date(),
        },
      })
      await prisma.emailEvent.create({
        data: { messageId: msg.id, eventType: 'BOUNCED', providerEventId: 'e' },
      })
      const { template, campaign, contact } = await seed()
      await enqueueConsentRequest(
        { contactId: contact.id, campaignId: campaign.id, templateId: template.id },
        ACTOR,
      )
      const r = await processQueue()
      expect(r.autoPaused).toBeUndefined()
      expect(r.sent).toBe(1)
    })
  })
})
