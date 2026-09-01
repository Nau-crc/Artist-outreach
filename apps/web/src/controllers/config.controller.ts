import { z } from 'zod'
import { getConfig, updateConfig, InvalidConfigError } from '@/models/config.model'
import type { ControllerInput } from '@/middleware/with-controller'
import { ValidationError } from '@/middleware/with-controller'

export const AppConfigPatchSchema = z
  .object({
    sendingEnabled: z.boolean().optional(),
    campaignEnabled: z.boolean().optional(),
    dailySendLimit: z.number().int().min(0).optional(),
    hourlySendLimit: z.number().int().min(0).optional(),
    minIntervalSeconds: z.number().int().min(0).optional(),
    consentRequestCooldownDays: z.number().int().min(0).optional(),
    bounceRateThresholdPct: z.number().min(0).max(100).optional(),
    bounceRateMinSample: z.number().int().min(0).optional(),
  })
  .strict()

export type AppConfigPatchInput = z.infer<typeof AppConfigPatchSchema>

export async function getConfigController(_input: ControllerInput<void, unknown>) {
  return getConfig()
}

export async function updateConfigController(
  input: ControllerInput<AppConfigPatchInput, unknown>,
) {
  const actorId = input.ctx.auth?.userId
  if (!actorId) {
    throw new Error('updateConfigController requires auth — misconfigured route')
  }
  try {
    return await updateConfig(input.body, actorId)
  } catch (err) {
    if (err instanceof InvalidConfigError) {
      throw new ValidationError([
        {
          code: 'custom',
          message: err.message,
          path: [],
          input: input.body,
        },
      ] as unknown as z.core.$ZodIssue[])
    }
    throw err
  }
}
