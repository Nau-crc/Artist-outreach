import { withController } from '@/middleware/with-controller'
import { PreviewCsvSchema, previewCsvController } from '@/controllers/discovery.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withController(previewCsvController, {
  bodySchema: PreviewCsvSchema,
  requireAdmin: true,
})
