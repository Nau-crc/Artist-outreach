import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { disconnect, truncateAll } from '../../tests/helpers/db'
import { InvalidConfigError, getConfig, updateConfig } from './config.model'

const ACTOR = '11111111-1111-1111-1111-111111111111'

describe('config.model (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  describe('getConfig', () => {
    it('creates the singleton if missing and returns defaults', async () => {
      const cfg = await getConfig()
      expect(cfg.id).toBe(1)
      expect(cfg.sendingEnabled).toBe(false)
      expect(cfg.campaignEnabled).toBe(false)
      expect(cfg.dailySendLimit).toBe(0)
      expect(cfg.consentRequestCooldownDays).toBe(90)
    })

    it('is idempotent', async () => {
      const a = await getConfig()
      const b = await getConfig()
      expect(a.id).toBe(b.id)
      expect(await prisma.appConfig.count()).toBe(1)
    })
  })

  describe('updateConfig', () => {
    it('updates fields and writes an audit log', async () => {
      await getConfig()
      const after = await updateConfig({ dailySendLimit: 50, hourlySendLimit: 5 }, ACTOR)
      expect(after.dailySendLimit).toBe(50)
      expect(after.hourlySendLimit).toBe(5)
      expect(after.updatedBy).toBe(ACTOR)

      const logs = await prisma.auditLog.findMany()
      expect(logs).toHaveLength(1)
      expect(logs[0]?.entityType).toBe('app_config')
      expect(logs[0]?.action).toBe('updated')
      expect(logs[0]?.actorId).toBe(ACTOR)
    })

    it('labels the audit action when sending toggles', async () => {
      await updateConfig({ dailySendLimit: 100 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      const logs = await prisma.auditLog.findMany({ orderBy: { at: 'asc' } })
      expect(logs).toHaveLength(2)
      expect(logs[0]?.action).toBe('updated')
      expect(logs[1]?.action).toBe('sending_toggled')
    })

    it('rejects enabling sending without daily limit', async () => {
      await expect(updateConfig({ sendingEnabled: true }, ACTOR)).rejects.toBeInstanceOf(
        InvalidConfigError,
      )
      const logs = await prisma.auditLog.findMany()
      expect(logs).toHaveLength(0)
    })

    it('rejects negative limits', async () => {
      await expect(updateConfig({ dailySendLimit: -1 }, ACTOR)).rejects.toBeInstanceOf(
        InvalidConfigError,
      )
    })

    it('no-op patch does not write an audit log', async () => {
      await getConfig()
      await updateConfig({}, ACTOR)
      expect(await prisma.auditLog.count()).toBe(0)
    })

    it('sending_toggled captures both booleans in before/after', async () => {
      await updateConfig({ dailySendLimit: 100 }, ACTOR)
      await updateConfig({ sendingEnabled: true }, ACTOR)
      const log = await prisma.auditLog.findFirst({ where: { action: 'sending_toggled' } })
      const before = log?.before as Record<string, unknown> | null
      const after = log?.after as Record<string, unknown> | null
      expect(before?.sendingEnabled).toBe(false)
      expect(after?.sendingEnabled).toBe(true)
    })
  })
})
