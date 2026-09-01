import { withController } from '@/middleware/with-controller'
import {
  CreateCampaignSchema,
  ListCampaignsSchema,
  createCampaignController,
  listCampaignsController,
} from '@/controllers/campaigns.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withController(listCampaignsController, {
  bodySchema: ListCampaignsSchema,
  requireAdmin: true,
})

export const POST = withController(createCampaignController, {
  bodySchema: CreateCampaignSchema,
  requireAdmin: true,
  status: 201,
})
