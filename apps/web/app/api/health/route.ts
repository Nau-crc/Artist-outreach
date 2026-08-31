import { NextResponse } from 'next/server'
import { healthController } from '@/controllers/health.controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const body = await healthController()
  return NextResponse.json(body, { status: 200 })
}
