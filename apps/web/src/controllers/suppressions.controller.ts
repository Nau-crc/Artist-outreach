import { z } from 'zod'
import {
  addSuppression,
  listSuppressions,
  removeSuppression,
} from '@/models/suppressions.model'
import type { ControllerInput } from '@/middleware/with-controller'

const SUPPRESSION_REASONS = ['UNSUBSCRIBE', 'COMPLAINT', 'HARD_BOUNCE', 'MANUAL', 'WITHDRAWN'] as const

export const AddSuppressionSchema = z
  .object({
    email: z.string().email(),
    reason: z.enum(SUPPRESSION_REASONS),
    notes: z.string().max(1000).optional(),
  })
  .strict()

export const ListSuppressionsSchema = z
  .object({
    email: z.string().optional(),
    reason: z.enum(SUPPRESSION_REASONS).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict()

export const SuppressionIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export type AddSuppressionInput = z.infer<typeof AddSuppressionSchema>
export type ListSuppressionsInput = z.infer<typeof ListSuppressionsSchema>
export type SuppressionIdParams = z.infer<typeof SuppressionIdParamsSchema>

export async function addSuppressionController(
  input: ControllerInput<AddSuppressionInput, unknown>,
) {
  const actorId = requireActor(input)
  return addSuppression(input.body, actorId)
}

export async function listSuppressionsController(
  input: ControllerInput<ListSuppressionsInput, unknown>,
) {
  return listSuppressions(input.body)
}

export async function removeSuppressionController(
  input: ControllerInput<void, SuppressionIdParams>,
) {
  const actorId = requireActor(input)
  await removeSuppression(input.ctx.params.id, actorId)
  return { ok: true as const }
}

function requireActor(input: ControllerInput<unknown, unknown>): string {
  const actorId = input.ctx.auth?.userId
  if (!actorId) throw new Error('Auth required — misconfigured route')
  return actorId
}
