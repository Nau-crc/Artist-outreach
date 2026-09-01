import { z } from 'zod'
import { listAudit } from '@/models/audit.model'
import type { ControllerInput } from '@/middleware/with-controller'

export const ListAuditSchema = z
  .object({
    entityType: z.string().max(64).optional(),
    entityId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    cursor: z.string().uuid().optional(),
  })
  .strict()

export type ListAuditInput = z.infer<typeof ListAuditSchema>

export async function listAuditController(input: ControllerInput<ListAuditInput, unknown>) {
  return listAudit(input.body)
}
