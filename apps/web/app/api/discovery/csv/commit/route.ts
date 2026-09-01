import { withController } from '@/middleware/with-controller'
import { CommitCsvSchema, commitCsvController } from '@/controllers/discovery.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(commitCsvController, {
  bodySchema: CommitCsvSchema,
  requireAdmin: true,
  status: 201,
})
