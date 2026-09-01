import type { Metadata } from 'next'
import { NewsletterClient } from './client'

export const metadata: Metadata = {
  title: 'Newsletter — Artist Outreach',
  description: 'Suscríbete voluntariamente a nuestra newsletter para artistas.',
}

export default function NewsletterPage() {
  return <NewsletterClient />
}
