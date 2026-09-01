'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ConfirmationCard, PublicLanding } from '@artist-outreach/ui'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; status: 'accepted' | 'declined' | 'already_answered' | 'invalid' }
  | { kind: 'error'; message: string }

export function ConsentClient({
  token,
  initialAction,
}: {
  token: string
  initialAction: 'decline' | null
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(action: 'accept' | 'decline') {
    setState({ kind: 'sending' })
    try {
      const res = await fetch(`/api/public/consent/${encodeURIComponent(token)}/${action}`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as { status?: string }
      if (
        body.status === 'accepted' ||
        body.status === 'declined' ||
        body.status === 'already_answered' ||
        body.status === 'invalid'
      ) {
        setState({ kind: 'done', status: body.status })
      } else {
        setState({ kind: 'error', message: 'Respuesta inesperada del servidor.' })
      }
    } catch {
      setState({ kind: 'error', message: 'Sin conexión. Vuelve a intentarlo.' })
    }
  }

  if (state.kind === 'done') {
    return (
      <PublicLanding
        title="Gracias"
        footer={
          <p>
            <Link href="/newsletter" className="underline">
              Ir a la página de la newsletter
            </Link>
          </p>
        }
      >
        {state.status === 'accepted' && (
          <ConfirmationCard
            variant="success"
            title="Suscripción confirmada"
            description="Recibirás nuestros contenidos en este correo. Puedes darte de baja con el enlace incluido en cada email."
          />
        )}
        {state.status === 'declined' && (
          <ConfirmationCard
            variant="info"
            title="Hemos anotado tu decisión"
            description="No te volveremos a contactar. Tu email queda en nuestra lista de supresión."
          />
        )}
        {state.status === 'already_answered' && (
          <ConfirmationCard
            variant="info"
            title="Ya nos habías respondido"
            description="Tu respuesta anterior sigue vigente. No haremos nada más."
          />
        )}
        {state.status === 'invalid' && (
          <ConfirmationCard
            variant="warning"
            title="Enlace no válido"
            description="El enlace que has usado no funciona o ha caducado. Si crees que es un error, escríbenos."
          />
        )}
      </PublicLanding>
    )
  }

  return (
    <PublicLanding
      title="¿Quieres recibir nuestra newsletter?"
      subtitle="Es un contenido periódico sobre comunicación para artistas."
      footer={
        <p>
          Al confirmar aceptas nuestra{' '}
          <Link href="/privacy" className="underline">
            política de privacidad
          </Link>
          . Puedes cambiar de opinión en cualquier momento.
        </p>
      }
    >
      <p className="text-sm text-text-secondary">
        Recibiste este enlace porque nos ha llegado tu contacto y creemos que nuestros contenidos
        pueden interesarte. No te enviaremos nada más hasta que tú lo confirmes aquí.
      </p>

      <div className="flex flex-col gap-2 mt-4">
        <button
          type="button"
          onClick={() => submit('accept')}
          disabled={state.kind === 'sending'}
          className="inline-flex items-center justify-center px-4 py-3 rounded-md text-base font-medium bg-brand-500 text-text-inverse hover:bg-brand-600 disabled:opacity-50"
        >
          {state.kind === 'sending' ? 'Enviando…' : 'Sí, quiero recibir la newsletter'}
        </button>
        <button
          type="button"
          onClick={() => submit('decline')}
          disabled={state.kind === 'sending'}
          className="inline-flex items-center justify-center px-4 py-3 rounded-md text-base font-medium bg-surface-subtle text-text-primary hover:bg-surface-muted disabled:opacity-50"
        >
          {state.kind === 'sending' && initialAction === 'decline'
            ? 'Procesando…'
            : 'No, gracias — no me volváis a contactar'}
        </button>
      </div>

      {state.kind === 'error' && (
        <p className="text-sm text-status-notEligible mt-2" role="alert">
          {state.message}
        </p>
      )}
    </PublicLanding>
  )
}
