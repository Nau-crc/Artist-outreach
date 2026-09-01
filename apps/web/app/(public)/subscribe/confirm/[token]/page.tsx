import type { Metadata } from 'next'
import { ConfirmClient } from './client'

export const metadata: Metadata = {
  title: 'Confirmar suscripción — Artist Outreach',
  robots: { index: false, follow: false },
}

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <ConfirmClient token={token} />
}
