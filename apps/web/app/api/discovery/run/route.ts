import { withController } from '@/middleware/with-controller'
import { RunProviderSchema, runProviderController } from '@/controllers/discovery.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(runProviderController, {
  bodySchema: RunProviderSchema,
  requireAdmin: true,
  status: 201,
})
