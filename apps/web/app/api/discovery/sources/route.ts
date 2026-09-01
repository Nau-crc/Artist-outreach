import { withController } from '@/middleware/with-controller'
import { listSourcesController } from '@/controllers/discovery.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listSourcesController, {
  requireAdmin: true,
})
