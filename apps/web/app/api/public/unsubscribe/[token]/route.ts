import { withController } from '@/middleware/with-controller'
import {
  TokenParamsSchema,
  unsubscribePublicController,
} from '@/controllers/public-newsletter.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(unsubscribePublicController, {
  paramsSchema: TokenParamsSchema,
  rateLimit: { key: 'public:unsubscribe', limit: 20, windowSeconds: 60 },
})
