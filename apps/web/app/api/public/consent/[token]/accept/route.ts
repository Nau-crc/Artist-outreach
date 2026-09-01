import { withController } from '@/middleware/with-controller'
import { TokenParamsSchema, acceptController } from '@/controllers/public-consent.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(acceptController, {
  paramsSchema: TokenParamsSchema,
  rateLimit: { key: 'public:consent-accept', limit: 20, windowSeconds: 60 },
})
