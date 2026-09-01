import { withController } from '@/middleware/with-controller'
import {
  IdParamsSchema,
  UnverifySchema,
  VerifySchema,
  unverifyController,
  verifyController,
} from '@/controllers/web-sources.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(verifyController, {
  paramsSchema: IdParamsSchema,
  bodySchema: VerifySchema,
  requireAdmin: true,
})

export const DELETE = withController(unverifyController, {
  paramsSchema: IdParamsSchema,
  bodySchema: UnverifySchema,
  requireAdmin: true,
})
