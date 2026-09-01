import { handleEmailWebhook } from '@/controllers/webhook-email.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  return handleEmailWebhook(request)
}
