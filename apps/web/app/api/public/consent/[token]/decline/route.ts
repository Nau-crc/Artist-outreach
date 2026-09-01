import { withController } from '@/middleware/with-controller'
import { TokenParamsSchema, declineController } from '@/controllers/public-consent.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(declineController, {
  paramsSchema: TokenParamsSchema,
  rateLimit: { key: 'public:consent-decline', limit: 20, windowSeconds: 60 },
})
