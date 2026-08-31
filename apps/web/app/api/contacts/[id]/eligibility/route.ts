import { withController } from '@/middleware/with-controller'
import {
  ContactIdParamsSchema,
  dryRunEligibilityController,
} from '@/controllers/contacts.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(dryRunEligibilityController, {
  paramsSchema: ContactIdParamsSchema,
  requireAdmin: true,
})
