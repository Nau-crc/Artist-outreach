import { z } from 'zod'
import type { ControllerInput } from '@/middleware/with-controller'
import { ConflictError, NotFoundError, ValidationError } from '@/middleware/with-controller'
import {
  CampaignNotFoundError,
  ContactNotFoundError,
  CooldownActiveError,
  DuplicateRequestError,
  TemplateInactiveError,
  TemplateNotFoundError,
  cancelConsentRequest,
  enqueueConsentRequest,
  listConsentRequests,
  processQueue,
  simulateEligibility,
} from '@/models/consent-requests.model'

export const EnqueueSchema = z
  .object({
    contactId: z.string().uuid(),
    campaignId: z.string().uuid(),
    templateId: z.string().uuid(),
  })
  .strict()

export const ListSchema = z
  .object({
    status: z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']).optional(),
    contactId: z.string().uuid().optional(),
    campaignId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict()

export const SimulateSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    templateId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()

export const IdParamsSchema = z.object({ id: z.string().uuid() })

export type EnqueueInput = z.infer<typeof EnqueueSchema>
export type SimulateInput = z.infer<typeof SimulateSchema>

export async function enqueueController(input: ControllerInput<EnqueueInput, unknown>) {
  const actorId = requireActor(input)
  try {
    return await enqueueConsentRequest(input.body, actorId)
  } catch (err) {
    if (err instanceof ContactNotFoundError || err instanceof CampaignNotFoundError || err instanceof TemplateNotFoundError) {
      throw new NotFoundError((err as Error).message)
    }
    if (err instanceof TemplateInactiveError || err instanceof DuplicateRequestError || err instanceof CooldownActiveError) {
      throw new ConflictError((err as Error).message)
    }
    throw err
  }
}

export async function listController(
  input: ControllerInput<
    { status?: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'; contactId?: string; campaignId?: string; limit?: number },
    unknown
  >,
) {
  return listConsentRequests(input.body)
}

export async function cancelController(input: ControllerInput<void, { id: string }>) {
  const actorId = requireActor(input)
  try {
    return await cancelConsentRequest(input.ctx.params.id, actorId)
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('not found')) throw new NotFoundError(msg)
    if (msg.includes('Cannot cancel')) throw wrapAsValidation(msg, input.ctx.params)
    throw err
  }
}

export async function simulateController(input: ControllerInput<SimulateInput, unknown>) {
  return simulateEligibility(input.body)
}

/**
 * POST /api/cron/consent-queue.
 * Protegido por CRON_SECRET (bearer). Devuelve el reporte del worker.
 */
export async function cronConsentQueueController(request: Request): Promise<Response> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /i, '')
  const secret = process.env.CRON_SECRET
  if (!secret || bearer !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const report = await processQueue()
  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
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
