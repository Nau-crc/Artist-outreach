import { z } from 'zod'
import {
  CONTACT_STATUS_VALUES,
  EMAIL_STATUS_VALUES,
  CONSENT_STATUS_VALUES,
  PERMISSION_VALUES,
} from '@artist-outreach/shared'
import type { ControllerInput } from '@/middleware/with-controller'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/middleware/with-controller'
import {
  ContactNotFoundError,
  DuplicateContactError,
  InvalidTransitionError,
  SuppressForbiddenError,
  createContact,
  dryRunEligibility,
  getContact,
  listContacts,
  reviewContact,
  updateContact,
} from '@/models/contacts.model'

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

export const CreateContactSchema = z
  .object({
    artistName: z.string().min(1).max(200),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    discipline: z.string().max(100).optional(),
    country: z.string().length(2).optional(),
    city: z.string().max(100).optional(),
    language: z.string().max(10).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export const UpdateContactSchema = z
  .object({
    artistName: z.string().min(1).max(200).optional(),
    email: z.union([z.string().email(), z.null()]).optional(),
    website: z.union([z.string().url(), z.null()]).optional(),
    discipline: z.union([z.string().max(100), z.null()]).optional(),
    country: z.union([z.string().length(2), z.null()]).optional(),
    city: z.union([z.string().max(100), z.null()]).optional(),
    language: z.union([z.string().max(10), z.null()]).optional(),
    notes: z.union([z.string().max(2000), z.null()]).optional(),
  })
  .strict()

export const ListContactsSchema = z
  .object({
    contactStatus: z.enum(CONTACT_STATUS_VALUES as [string, ...string[]]).optional(),
    permission: z.enum(PERMISSION_VALUES as [string, ...string[]]).optional(),
    country: z.string().length(2).optional(),
    discipline: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    cursor: z.string().uuid().optional(),
  })
  .strict()

export const ContactIdParamsSchema = z.object({ id: z.string().uuid() })

export const ReviewDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('APPROVE') }).strict(),
  z.object({ kind: z.literal('DISCARD'), reason: z.string().max(500).optional() }).strict(),
  z.object({ kind: z.literal('SUPPRESS'), reason: z.string().max(500).optional() }).strict(),
])

export type CreateContactInputDto = z.infer<typeof CreateContactSchema>
export type UpdateContactInputDto = z.infer<typeof UpdateContactSchema>
export type ListContactsInputDto = z.infer<typeof ListContactsSchema>
export type ContactIdParamsDto = z.infer<typeof ContactIdParamsSchema>
export type ReviewDecisionDto = z.infer<typeof ReviewDecisionSchema>

// Re-exports to keep enum values available for tests / clients.
export {
  CONTACT_STATUS_VALUES,
  EMAIL_STATUS_VALUES,
  CONSENT_STATUS_VALUES,
  PERMISSION_VALUES,
}

// ────────────────────────────────────────────────────────────────
// Controllers
// ────────────────────────────────────────────────────────────────

export async function listContactsController(
  input: ControllerInput<ListContactsInputDto, unknown>,
) {
  return listContacts(input.body as Parameters<typeof listContacts>[0])
}

export async function getContactController(
  input: ControllerInput<void, ContactIdParamsDto>,
) {
  try {
    return await getContact(input.ctx.params.id)
  } catch (err) {
    if (err instanceof ContactNotFoundError) throw new NotFoundError(err.message)
    throw err
  }
}

export async function createContactController(
  input: ControllerInput<CreateContactInputDto, unknown>,
) {
  const actorId = requireActor(input)
  try {
    return await createContact(input.body, actorId)
  } catch (err) {
    if (err instanceof DuplicateContactError) throw new ConflictError(err.message)
    throw err
  }
}

export async function updateContactController(
  input: ControllerInput<UpdateContactInputDto, ContactIdParamsDto>,
) {
  const actorId = requireActor(input)
  try {
    return await updateContact(input.ctx.params.id, input.body, actorId)
  } catch (err) {
    if (err instanceof ContactNotFoundError) throw new NotFoundError(err.message)
    if (err instanceof DuplicateContactError) throw new ConflictError(err.message)
    throw err
  }
}

export async function reviewContactController(
  input: ControllerInput<ReviewDecisionDto, ContactIdParamsDto>,
) {
  const actorId = requireActor(input)
  try {
    return await reviewContact(input.ctx.params.id, input.body, actorId)
  } catch (err) {
    if (err instanceof ContactNotFoundError) throw new NotFoundError(err.message)
    if (err instanceof InvalidTransitionError) throw wrapAsValidation(err.message, input.body)
    if (err instanceof SuppressForbiddenError) throw wrapAsValidation(err.message, input.body)
    throw err
  }
}

export async function dryRunEligibilityController(
  input: ControllerInput<void, ContactIdParamsDto>,
) {
  try {
    return await dryRunEligibility(input.ctx.params.id)
  } catch (err) {
    if (err instanceof ContactNotFoundError) throw new NotFoundError(err.message)
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
