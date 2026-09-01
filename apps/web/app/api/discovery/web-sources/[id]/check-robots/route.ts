import { withController } from '@/middleware/with-controller'
import { IdParamsSchema, checkRobotsController } from '@/controllers/web-sources.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(checkRobotsController, {
  paramsSchema: IdParamsSchema,
  requireAdmin: true,
})
