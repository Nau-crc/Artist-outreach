import { withController } from '@/middleware/with-controller'
import {
  PreviewSchema,
  TemplateIdParamsSchema,
  previewTemplateController,
} from '@/controllers/templates.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(previewTemplateController, {
  paramsSchema: TemplateIdParamsSchema,
  bodySchema: PreviewSchema,
  requireAdmin: true,
})
