import { withController } from '@/middleware/with-controller'
import { IdParamsSchema, cancelController } from '@/controllers/consent-requests.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const DELETE = withController(cancelController, {
  paramsSchema: IdParamsSchema,
  requireAdmin: true,
})
