import { withController } from '@/middleware/with-controller'
import {
  SuppressionIdParamsSchema,
  removeSuppressionController,
} from '@/controllers/suppressions.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const DELETE = withController(removeSuppressionController, {
  paramsSchema: SuppressionIdParamsSchema,
  requireAdmin: true,
})
