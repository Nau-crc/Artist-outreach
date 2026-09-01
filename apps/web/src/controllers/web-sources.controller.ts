import { z } from 'zod'
import {
  InvalidUrlError,
  SourceNotVerifiedError,
  WebSourceNotFoundError,
  checkWebSourceRobots,
  createWebSource,
  extractFromWebSource,
  getWebSource,
  listWebSources,
  unverifyWebSource,
  verifyWebSource,
} from '@/models/web-sources.model'
import type { ControllerInput } from '@/middleware/with-controller'
import { ConflictError, NotFoundError, ValidationError } from '@/middleware/with-controller'

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

export const CreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    url: z.string().url(),
    complianceNotes: z.string().max(2000).optional(),
    termsUrl: z.string().url().optional(),
  })
  .strict()

export const VerifySchema = z
  .object({
    authorizationRef: z.string().min(1).max(500),
    complianceNotes: z.string().min(1).max(2000),
  })
  .strict()

export const UnverifySchema = z
  .object({
    reason: z.string().min(1).max(2000),
  })
  .strict()

export const ExtractSchema = z
  .object({
    maxPages: z.number().int().min(1).max(500).optional(),
    maxDepth: z.number().int().min(0).max(5).optional(),
    rateLimitMs: z.number().int().min(500).max(60_000).optional(),
  })
  .strict()

export const IdParamsSchema = z.object({ id: z.string().uuid() })

// ────────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────────

export async function listController(_input: ControllerInput<void, unknown>) {
  return listWebSources()
}

export async function getController(input: ControllerInput<void, { id: string }>) {
  try {
    return await getWebSource(input.ctx.params.id)
  } catch (err) {
    if (err instanceof WebSourceNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function createController(
  input: ControllerInput<z.infer<typeof CreateSchema>, unknown>,
) {
  const actorId = requireActor(input)
  try {
    return await createWebSource(input.body, actorId)
  } catch (err) {
    if (err instanceof InvalidUrlError) throw wrapAsValidation(err.message, input.body)
    throw err
  }
}

export async function verifyController(
  input: ControllerInput<z.infer<typeof VerifySchema>, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    return await verifyWebSource(input.ctx.params.id, input.body, actorId)
  } catch (err) {
    if (err instanceof WebSourceNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function unverifyController(
  input: ControllerInput<z.infer<typeof UnverifySchema>, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    return await unverifyWebSource(input.ctx.params.id, input.body.reason, actorId)
  } catch (err) {
    if (err instanceof WebSourceNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function checkRobotsController(
  input: ControllerInput<void, { id: string }>,
) {
  try {
    return await checkWebSourceRobots(input.ctx.params.id)
  } catch (err) {
    if (err instanceof WebSourceNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function extractController(
  input: ControllerInput<z.infer<typeof ExtractSchema>, { id: string }>,
) {
  const actorId = requireActor(input)
  try {
    return await extractFromWebSource(input.ctx.params.id, input.body, actorId)
  } catch (err) {
    if (err instanceof WebSourceNotFoundError) throw new NotFoundError(err.message)
    if (err instanceof SourceNotVerifiedError) throw new ConflictError(err.message)
    throw err
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

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
