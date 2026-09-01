import { withController } from '@/middleware/with-controller'
import {
  EnqueueSchema,
  ListSchema,
  enqueueController,
  listController,
} from '@/controllers/consent-requests.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listController, {
  bodySchema: ListSchema,
  requireAdmin: true,
})

export const POST = withController(enqueueController, {
  bodySchema: EnqueueSchema,
  requireAdmin: true,
  status: 201,
})
