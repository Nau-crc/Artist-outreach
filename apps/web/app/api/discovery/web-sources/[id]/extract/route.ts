import { withController } from '@/middleware/with-controller'
import { ExtractSchema, IdParamsSchema, extractController } from '@/controllers/web-sources.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(extractController, {
  paramsSchema: IdParamsSchema,
  bodySchema: ExtractSchema,
  requireAdmin: true,
})
