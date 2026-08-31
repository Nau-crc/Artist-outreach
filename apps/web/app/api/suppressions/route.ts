import { withController } from '@/middleware/with-controller'
import {
  AddSuppressionSchema,
  ListSuppressionsSchema,
  addSuppressionController,
  listSuppressionsController,
} from '@/controllers/suppressions.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listSuppressionsController, {
  bodySchema: ListSuppressionsSchema,
  requireAdmin: true,
})

export const POST = withController(addSuppressionController, {
  bodySchema: AddSuppressionSchema,
  requireAdmin: true,
  status: 201,
})
