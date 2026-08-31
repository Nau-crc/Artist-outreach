import { withController } from '@/middleware/with-controller'
import {
  AppConfigPatchSchema,
  getConfigController,
  updateConfigController,
} from '@/controllers/config.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(getConfigController, {
  requireAdmin: true,
})

export const PATCH = withController(updateConfigController, {
  bodySchema: AppConfigPatchSchema,
  requireAdmin: true,
})
