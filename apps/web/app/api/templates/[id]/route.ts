import { withController } from '@/middleware/with-controller'
import {
  TemplateIdParamsSchema,
  UpdateTemplateSchema,
  deleteTemplateController,
  getTemplateController,
  updateTemplateController,
} from '@/controllers/templates.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(getTemplateController, {
  paramsSchema: TemplateIdParamsSchema,
  requireAdmin: true,
})

export const PATCH = withController(updateTemplateController, {
  paramsSchema: TemplateIdParamsSchema,
  bodySchema: UpdateTemplateSchema,
  requireAdmin: true,
})

export const DELETE = withController(deleteTemplateController, {
  paramsSchema: TemplateIdParamsSchema,
  requireAdmin: true,
})
