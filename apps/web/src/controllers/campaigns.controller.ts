import { z } from 'zod'
import {
  CampaignInUseError,
  CampaignNotFoundError,
  InvalidCampaignDatesError,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
} from '@/models/campaigns.model'
import type { ControllerInput } from '@/middleware/with-controller'
import { ConflictError, NotFoundError, ValidationError } from '@/middleware/with-controller'

export const CreateCampaignSchema = z
  .object({
    name: z.string().min(1).max(200),
    active: z.boolean().optional(),
    startsAt: z.union([z.string().datetime(), z.null()]).optional(),
    endsAt: z.union([z.string().datetime(), z.null()]).optional(),
    maxSends: z.union([z.number().int().min(1).max(1_000_000), z.null()]).optional(),
  })
  .strict()

export const UpdateCampaignSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    active: z.boolean().optional(),
    startsAt: z.union([z.string().datetime(), z.null()]).optional(),
    endsAt: z.union([z.string().datetime(), z.null()]).optional(),
    maxSends: z.union([z.number().int().min(1).max(1_000_000), z.null()]).optional(),
  })
  .strict()

export const ListCampaignsSchema = z
  .object({
    active: z
      .union([z.literal('true'), z.literal('false')])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict()

export const CampaignIdParamsSchema = z.object({ id: z.string().uuid() })

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>

export async function listCampaignsController(
  input: ControllerInput<{ active?: boolean }, unknown>,
) {
  const params: { active?: boolean } = {}
  if (input.body.active !== undefined) params.active = input.body.active
  return listCampaigns(params)
}

export async function getCampaignController(
  input: ControllerInput<void, { id: string }>,
) {
  try {
    return await getCampaign(input.ctx.params.id)
  } catch (err) {
    if (err instanceof CampaignNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function createCampaignController(
  input: ControllerInput<CreateCampaignInput, unknown>,
) {
  const actorId = requireActor(input)
  try {
    return await createCampaign(input.body, actorId)
  } catch (err) {
    if (err instanceof InvalidCampaignDatesError) throw wrapAsValidation(err.message, input.body)
    throw err
  }
}

export async function updateCampaignController(
  input: ControllerInput<UpdateCampaignInput, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    return await updateCampaign(input.ctx.params.id, input.body, actorId)
  } catch (err) {
    if (err instanceof CampaignNotFoundError) throw new NotFoundError(err.message)
    if (err instanceof InvalidCampaignDatesError) throw wrapAsValidation(err.message, input.body)
    throw err
  }
}

export async function deleteCampaignController(
  input: ControllerInput<void, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    await deleteCampaign(input.ctx.params.id, actorId)
    return { ok: true as const }
  } catch (err) {
    if (err instanceof CampaignNotFoundError) throw new NotFoundError(err.message)
    if (err instanceof CampaignInUseError) throw new ConflictError(err.message)
    throw err
  }
}

function requireActor(input: ControllerInput<unknown, unknown>): string {
  const actorId = input.ctx.auth?.userId
  if (!actorId) throw new Error('Auth required — misconfigured route')
  return actorId
}

function wrapAsValidation(message: string, input: unknown): ValidationError {
  return new ValidationError([
    { code: 'custom', message, path: [], input },
  ] as unknown as z.core.$ZodIssue[])
}
