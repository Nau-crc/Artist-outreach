'use client'

import Link from 'next/link'
import { SubscribeForm, PublicLanding } from '@artist-outreach/ui'

export function NewsletterClient() {
  return (
    <PublicLanding
      title="Newsletter"
      subtitle="Comunicación para artistas — oral y escrita. Publicamos contenidos periódicos con recursos prácticos."
      footer={
        <p>
          Al suscribirte, aceptas nuestra{' '}
          <Link href="/privacy" className="underline">
            política de privacidad
          </Link>
          . Puedes darte de baja en cualquier momento con el enlace de cada email.
        </p>
      }
    >
      <p className="text-sm text-text-secondary">
        Escribe tu email y recibirás un enlace para confirmar tu suscripción. Sin ese
        segundo paso, no te añadimos a la lista.
      </p>

      <SubscribeForm
        privacyHref="/privacy"
        onSubmit={async (email) => {
          try {
            const res = await fetch('/api/public/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            })
            if (res.status === 429) return { error: 'Demasiados intentos, espera un momento e intenta de nuevo.' }
            if (!res.ok) return { error: 'No se pudo enviar tu solicitud. Vuelve a intentarlo en un momento.' }
            return 'ok'
          } catch {
            return { error: 'Sin conexión. Comprueba tu red e intenta otra vez.' }
          }
        }}
      />
    </PublicLanding>
  )
}
