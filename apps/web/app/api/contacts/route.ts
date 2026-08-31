import { withController } from '@/middleware/with-controller'
import {
  CreateContactSchema,
  ListContactsSchema,
  createContactController,
  listContactsController,
} from '@/controllers/contacts.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listContactsController, {
  bodySchema: ListContactsSchema,
  requireAdmin: true,
})

export const POST = withController(createContactController, {
  bodySchema: CreateContactSchema,
  requireAdmin: true,
  status: 201,
})
