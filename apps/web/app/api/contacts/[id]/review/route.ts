import { withController } from '@/middleware/with-controller'
import {
  ContactIdParamsSchema,
  ReviewDecisionSchema,
  reviewContactController,
} from '@/controllers/contacts.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(reviewContactController, {
  paramsSchema: ContactIdParamsSchema,
  bodySchema: ReviewDecisionSchema,
  requireAdmin: true,
})
