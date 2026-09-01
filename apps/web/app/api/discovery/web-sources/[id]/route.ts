import { withController } from '@/middleware/with-controller'
import { IdParamsSchema, getController } from '@/controllers/web-sources.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(getController, {
  paramsSchema: IdParamsSchema,
  requireAdmin: true,
})
