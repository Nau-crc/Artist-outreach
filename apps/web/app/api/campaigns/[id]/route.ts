import { withController } from '@/middleware/with-controller'
import {
  CampaignIdParamsSchema,
  UpdateCampaignSchema,
  deleteCampaignController,
  getCampaignController,
  updateCampaignController,
} from '@/controllers/campaigns.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(getCampaignController, {
  paramsSchema: CampaignIdParamsSchema,
  requireAdmin: true,
})

export const PATCH = withController(updateCampaignController, {
  paramsSchema: CampaignIdParamsSchema,
  bodySchema: UpdateCampaignSchema,
  requireAdmin: true,
})

export const DELETE = withController(deleteCampaignController, {
  paramsSchema: CampaignIdParamsSchema,
  requireAdmin: true,
})
