import type { Metadata } from 'next'
import { UnsubscribeClient } from './client'

export const metadata: Metadata = {
  title: 'Baja de la newsletter — Artist Outreach',
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <UnsubscribeClient token={token} />
}
