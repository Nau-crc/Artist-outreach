'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ConfirmationCard, PublicLanding } from '@artist-outreach/ui'

type State =
  | { kind: 'loading' }
  | { kind: 'confirmed' }
  | { kind: 'invalid' }
  | { kind: 'error' }

export function ConfirmClient({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/public/confirm/${encodeURIComponent(token)}`, {
          method: 'POST',
        })
        if (cancelled) return
        if (res.ok) setState({ kind: 'confirmed' })
        else if (res.status === 404) setState({ kind: 'invalid' })
        else setState({ kind: 'error' })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <PublicLanding
      title="Confirmar suscripción"
      footer={
        <p>
          <Link href="/newsletter" className="underline">
            Volver a la newsletter
          </Link>
        </p>
      }
    >
      {state.kind === 'loading' && (
        <ConfirmationCard variant="info" title="Confirmando…" description="Un segundo." />
      )}
      {state.kind === 'confirmed' && (
        <ConfirmationCard
          variant="success"
          title="Suscripción confirmada"
          description="Gracias. A partir de ahora recibirás la newsletter en este correo. En cada envío tendrás un enlace para darte de baja."
        />
      )}
      {state.kind === 'invalid' && (
        <ConfirmationCard
          variant="warning"
          title="Enlace no válido o caducado"
          description="El enlace que has usado ya no funciona. Puedes solicitar uno nuevo desde la página de la newsletter."
        />
      )}
      {state.kind === 'error' && (
        <ConfirmationCard
          variant="error"
          title="No hemos podido confirmar"
          description="Se ha producido un error. Recarga la página o vuelve a intentarlo en unos minutos."
        />
      )}
    </PublicLanding>
  )
}
