import { withController } from '@/middleware/with-controller'
import {
  PublicSubscribeSchema,
  subscribePublicController,
} from '@/controllers/public-newsletter.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(subscribePublicController, {
  bodySchema: PublicSubscribeSchema,
  rateLimit: { key: 'public:subscribe', limit: 5, windowSeconds: 300 },
})
