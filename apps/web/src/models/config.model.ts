import type { AppConfig } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit.model'

const CONFIG_ID = 1

export type AppConfigDto = Omit<AppConfig, 'id'>

const patchableFields = [
  'sendingEnabled',
  'campaignEnabled',
  'dailySendLimit',
  'hourlySendLimit',
  'minIntervalSeconds',
  'consentRequestCooldownDays',
  'bounceRateThresholdPct',
  'bounceRateMinSample',
] as const

export type AppConfigPatch = Partial<Pick<AppConfig, (typeof patchableFields)[number]>>

export async function getConfig(): Promise<AppConfig> {
  const existing = await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } })
  if (existing) return existing
  return prisma.appConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  })
}

export async function updateConfig(patch: AppConfigPatch, actorId: string): Promise<AppConfig> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.appConfig.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    })

    const data = pickPatchable(patch)
    if (Object.keys(data).length === 0) {
      return before
    }

    validateLimits({ ...before, ...data })

    const after = await tx.appConfig.update({
      where: { id: CONFIG_ID },
      data: { ...data, updatedBy: actorId },
    })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'app_config',
        entityId: null,
        action: sendingChanged(before, after) ? 'sending_toggled' : 'updated',
        before: serialize(before),
        after: serialize(after),
      },
      tx,
    )

    return after
  })
}

function pickPatchable(patch: AppConfigPatch): AppConfigPatch {
  const result: AppConfigPatch = {}
  for (const key of patchableFields) {
    const value = patch[key]
    if (value !== undefined) {
      ;(result as Record<string, unknown>)[key] = value
    }
  }
  return result
}

function validateLimits(cfg: AppConfig): void {
  const nonNegatives: Array<keyof AppConfig> = [
    'dailySendLimit',
    'hourlySendLimit',
    'minIntervalSeconds',
    'consentRequestCooldownDays',
    'bounceRateMinSample',
  ]
  for (const key of nonNegatives) {
    const value = cfg[key] as number
    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
      throw new InvalidConfigError(`${key} must be a non-negative integer`)
    }
  }
  if (
    typeof cfg.bounceRateThresholdPct !== 'number' ||
    cfg.bounceRateThresholdPct < 0 ||
    cfg.bounceRateThresholdPct > 100
  ) {
    throw new InvalidConfigError('bounceRateThresholdPct must be between 0 and 100')
  }
  if (cfg.sendingEnabled && cfg.dailySendLimit === 0) {
    throw new InvalidConfigError('sendingEnabled requires dailySendLimit > 0')
  }
}

/**
 * Auto-pausa el envío por umbral de rebotes. Escribe autoPausedAt +
 * autoPausedReason y sendingEnabled=false en una única transacción.
 * Idempotente: si ya está pausado, no reescribe.
 */
export async function autoPauseSending(reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.appConfig.findUnique({ where: { id: CONFIG_ID } })
    if (!current || !current.sendingEnabled) return
    const after = await tx.appConfig.update({
      where: { id: CONFIG_ID },
      data: {
        sendingEnabled: false,
        autoPausedAt: new Date(),
        autoPausedReason: reason,
      },
    })
    await writeAudit(
      {
        actorId: null,
        actorKind: 'SYSTEM',
        entityType: 'app_config',
        entityId: null,
        action: 'auto_paused',
        before: { sendingEnabled: current.sendingEnabled },
        after: { sendingEnabled: after.sendingEnabled, reason },
      },
      tx,
    )
  })
}

function sendingChanged(before: AppConfig, after: AppConfig): boolean {
  return before.sendingEnabled !== after.sendingEnabled || before.campaignEnabled !== after.campaignEnabled
}

function serialize(cfg: AppConfig): Record<string, unknown> {
  return {
    sendingEnabled: cfg.sendingEnabled,
    campaignEnabled: cfg.campaignEnabled,
    dailySendLimit: cfg.dailySendLimit,
    hourlySendLimit: cfg.hourlySendLimit,
    minIntervalSeconds: cfg.minIntervalSeconds,
    consentRequestCooldownDays: cfg.consentRequestCooldownDays,
  }
}

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidConfigError'
  }
}
