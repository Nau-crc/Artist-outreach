import { withController } from '@/middleware/with-controller'
import { ListRunsSchema, listRunsController } from '@/controllers/discovery.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listRunsController, {
  bodySchema: ListRunsSchema,
  requireAdmin: true,
})
