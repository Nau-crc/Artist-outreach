import { withController } from '@/middleware/with-controller'
import {
  CreateTemplateSchema,
  ListTemplatesSchema,
  createTemplateController,
  listTemplatesController,
} from '@/controllers/templates.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listTemplatesController, {
  bodySchema: ListTemplatesSchema,
  requireAdmin: true,
})

export const POST = withController(createTemplateController, {
  bodySchema: CreateTemplateSchema,
  requireAdmin: true,
  status: 201,
})
