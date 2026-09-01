import { z } from 'zod'
import {
  acceptConsentRequest,
  declineConsentRequest,
} from '@/models/consent-requests.model'
import type { ControllerInput } from '@/middleware/with-controller'

export const TokenParamsSchema = z.object({
  token: z.string().min(20).max(200),
})

export type TokenParams = z.infer<typeof TokenParamsSchema>

export async function acceptController(input: ControllerInput<void, TokenParams>) {
  return acceptConsentRequest(input.ctx.params.token)
}

export async function declineController(input: ControllerInput<void, TokenParams>) {
  return declineConsentRequest(input.ctx.params.token)
}
