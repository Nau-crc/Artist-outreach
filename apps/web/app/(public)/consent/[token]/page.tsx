import type { Metadata } from 'next'
import { ConsentClient } from './client'

export const metadata: Metadata = {
  title: 'Solicitud de suscripción — Artist Outreach',
  robots: { index: false, follow: false },
}

export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const { token } = await params
  const { action } = await searchParams
  return <ConsentClient token={token} initialAction={action === 'decline' ? 'decline' : null} />
}
