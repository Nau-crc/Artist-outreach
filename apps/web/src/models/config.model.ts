import type { AppConfig, Prisma } from '@prisma/client'
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

function pickPatchable(patch: AppConfigPatch): Prisma.AppConfigUpdateInput {
  const result: Prisma.AppConfigUpdateInput = {}
  for (const key of patchableFields) {
    if (patch[key] !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: propagación puntual controlada
      ;(result as any)[key] = patch[key]
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
  ]
  for (const key of nonNegatives) {
    const value = cfg[key] as number
    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
      throw new InvalidConfigError(`${key} must be a non-negative integer`)
    }
  }
  if (cfg.sendingEnabled && cfg.dailySendLimit === 0) {
    throw new InvalidConfigError('sendingEnabled requires dailySendLimit > 0')
  }
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
