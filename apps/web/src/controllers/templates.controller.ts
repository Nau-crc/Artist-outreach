import { z } from 'zod'
import {
  TemplateInUseError,
  TemplateNotFoundError,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  renderTemplate,
  updateTemplate,
} from '@/models/templates.model'
import type { ControllerInput } from '@/middleware/with-controller'
import { ConflictError, NotFoundError, ValidationError } from '@/middleware/with-controller'

export const CreateTemplateSchema = z
  .object({
    name: z.string().min(1).max(200),
    subject: z.string().min(1).max(200),
    bodyHtml: z.string().min(1).max(50_000),
    bodyText: z.string().min(1).max(50_000),
    active: z.boolean().optional(),
  })
  .strict()

export const UpdateTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(200).optional(),
    bodyHtml: z.string().min(1).max(50_000).optional(),
    bodyText: z.string().min(1).max(50_000).optional(),
    active: z.boolean().optional(),
  })
  .strict()

export const ListTemplatesSchema = z
  .object({
    active: z
      .union([z.literal('true'), z.literal('false')])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict()

export const TemplateIdParamsSchema = z.object({ id: z.string().uuid() })

export const PreviewSchema = z
  .object({
    artistName: z.string().max(200).optional(),
    confirmUrl: z.string().url().optional(),
    unsubscribeUrl: z.string().url().optional(),
  })
  .strict()

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>
export type PreviewInput = z.infer<typeof PreviewSchema>

// ────────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────────

export async function listTemplatesController(
  input: ControllerInput<{ active?: boolean }, unknown>,
) {
  const params: { active?: boolean } = {}
  if (input.body.active !== undefined) params.active = input.body.active
  return listTemplates(params)
}

export async function getTemplateController(
  input: ControllerInput<void, { id: string }>,
) {
  try {
    return await getTemplate(input.ctx.params.id)
  } catch (err) {
    if (err instanceof TemplateNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function createTemplateController(
  input: ControllerInput<CreateTemplateInput, unknown>,
) {
  const actorId = requireActor(input)
  return createTemplate(input.body, actorId)
}

export async function updateTemplateController(
  input: ControllerInput<UpdateTemplateInput, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    return await updateTemplate(input.ctx.params.id, input.body, actorId)
  } catch (err) {
    if (err instanceof TemplateNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function deleteTemplateController(
  input: ControllerInput<void, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    await deleteTemplate(input.ctx.params.id, actorId)
    return { ok: true as const }
  } catch (err) {
    if (err instanceof TemplateNotFoundError) throw new NotFoundError(err.message)
    if (err instanceof TemplateInUseError) throw new ConflictError(err.message)
    throw err
  }
}

export async function previewTemplateController(
  input: ControllerInput<PreviewInput, { id: string }>,
) {
  try {
    return await renderTemplate(input.ctx.params.id, input.body)
  } catch (err) {
    if (err instanceof TemplateNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

function requireActor(input: ControllerInput<unknown, unknown>): string {
  const actorId = input.ctx.auth?.userId
  if (!actorId) throw new Error('Auth required — misconfigured route')
  return actorId
}
