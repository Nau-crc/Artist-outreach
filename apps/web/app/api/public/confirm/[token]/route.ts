import { withController } from '@/middleware/with-controller'
import {
  TokenParamsSchema,
  confirmPublicController,
} from '@/controllers/public-newsletter.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(confirmPublicController, {
  paramsSchema: TokenParamsSchema,
  rateLimit: { key: 'public:confirm', limit: 20, windowSeconds: 60 },
})
