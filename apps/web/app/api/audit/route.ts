import { withController } from '@/middleware/with-controller'
import { ListAuditSchema, listAuditController } from '@/controllers/audit.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listAuditController, {
  bodySchema: ListAuditSchema,
  requireAdmin: true,
})
