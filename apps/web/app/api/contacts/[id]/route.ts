import { withController } from '@/middleware/with-controller'
import {
  ContactIdParamsSchema,
  UpdateContactSchema,
  getContactController,
  updateContactController,
} from '@/controllers/contacts.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(getContactController, {
  paramsSchema: ContactIdParamsSchema,
  requireAdmin: true,
})

export const PATCH = withController(updateContactController, {
  paramsSchema: ContactIdParamsSchema,
  bodySchema: UpdateContactSchema,
  requireAdmin: true,
})
