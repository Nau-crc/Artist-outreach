import { withController } from '@/middleware/with-controller'
import { CreateSchema, createController, listController } from '@/controllers/web-sources.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listController, { requireAdmin: true })

export const POST = withController(createController, {
  bodySchema: CreateSchema,
  requireAdmin: true,
  status: 201,
})
