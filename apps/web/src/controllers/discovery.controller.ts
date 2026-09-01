import { z } from 'zod'
import {
  UnknownProviderError,
  commitCsvImport,
  listDiscoveryRuns,
  listDiscoverySources,
  previewCsvImport,
  runProvider,
} from '@/models/discovery.model'
import { ProviderNotVerifiedError } from '@/services/discovery/registry'
import type { ControllerInput } from '@/middleware/with-controller'
import { NotFoundError, ValidationError } from '@/middleware/with-controller'
import {
  CsvTooLargeError,
  CsvTooManyRowsError,
  InvalidCsvError,
} from '@/services/discovery/providers/csv-import.provider'

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const ColumnMappingSchema = z.object({
  artistName: z.string().min(1),
  email: z.string().min(1).optional(),
  website: z.string().min(1).optional(),
  discipline: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
})

const OptionalMappingSchema = z.object({
  artistName: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  website: z.string().min(1).optional(),
  discipline: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
})

export const PreviewCsvSchema = z
  .object({
    csvText: z.string().min(1).max(6 * 1024 * 1024),
    mapping: OptionalMappingSchema.optional(),
  })
  .strict()

export const CommitCsvSchema = z
  .object({
    csvText: z.string().min(1).max(6 * 1024 * 1024),
    mapping: ColumnMappingSchema,
  })
  .strict()

export const RunProviderSchema = z
  .object({
    sourceSlug: z.string().min(1),
    params: z.object({
      discipline: z.string().optional(),
      country: z.string().length(2).optional(),
      city: z.string().optional(),
      language: z.string().optional(),
      keywords: z.array(z.string()).max(10).optional(),
      maxResults: z.number().int().min(1).max(100),
    }),
  })
  .strict()

export const ListRunsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type PreviewCsvInput = z.infer<typeof PreviewCsvSchema>
export type CommitCsvInput = z.infer<typeof CommitCsvSchema>
export type RunProviderInput = z.infer<typeof RunProviderSchema>

// ────────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────────

export async function listSourcesController(_input: ControllerInput<void, unknown>) {
  return listDiscoverySources()
}

export async function listRunsController(
  input: ControllerInput<{ limit?: number }, unknown>,
) {
  return listDiscoveryRuns(input.body.limit)
}

export async function previewCsvController(
  input: ControllerInput<PreviewCsvInput, unknown>,
) {
  try {
    return previewCsvImport(input.body.csvText, input.body.mapping)
  } catch (err) {
    if (err instanceof CsvTooLargeError || err instanceof CsvTooManyRowsError || err instanceof InvalidCsvError) {
      throw wrapAsValidation(err.message, input.body)
    }
    throw err
  }
}

export async function commitCsvController(input: ControllerInput<CommitCsvInput, unknown>) {
  const actorId = requireActor(input)
  try {
    return await commitCsvImport(input.body, actorId)
  } catch (err) {
    if (err instanceof CsvTooLargeError || err instanceof CsvTooManyRowsError || err instanceof InvalidCsvError) {
      throw wrapAsValidation(err.message, input.body)
    }
    if (err instanceof ProviderNotVerifiedError) {
      throw wrapAsValidation(err.message, input.body)
    }
    throw err
  }
}

export async function runProviderController(
  input: ControllerInput<RunProviderInput, unknown>,
) {
  const actorId = requireActor(input)
  try {
    return await runProvider(input.body, actorId)
  } catch (err) {
    if (err instanceof ProviderNotVerifiedError) {
      throw wrapAsValidation(err.message, input.body)
    }
    if (err instanceof UnknownProviderError) {
      throw new NotFoundError(err.message)
    }
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
