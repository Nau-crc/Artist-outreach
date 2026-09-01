import { withController } from '@/middleware/with-controller'
import { SimulateSchema, simulateController } from '@/controllers/consent-requests.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(simulateController, {
  bodySchema: SimulateSchema,
  requireAdmin: true,
})
