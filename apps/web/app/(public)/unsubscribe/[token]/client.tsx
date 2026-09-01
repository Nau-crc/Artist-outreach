'use client'

import { useState } from 'react'
import { ConfirmationCard, PublicLanding } from '@artist-outreach/ui'

type State =
  | { kind: 'confirm' }
  | { kind: 'sending' }
  | { kind: 'done'; message: string; variant: 'success' | 'info' | 'warning' | 'error' }

export function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'confirm' })

  async function submit() {
    setState({ kind: 'sending' })
    try {
      const res = await fetch(`/api/public/unsubscribe/${encodeURIComponent(token)}`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as { status?: string }
      if (body.status === 'unsubscribed') {
        setState({
          kind: 'done',
          variant: 'success',
          message: 'Te hemos dado de baja. No recibirás más comunicaciones a este correo.',
        })
      } else if (body.status === 'already_unsubscribed') {
        setState({
          kind: 'done',
          variant: 'info',
          message: 'Ya estabas dado de baja. No haremos nada más.',
        })
      } else {
        setState({
          kind: 'done',
          variant: 'warning',
          message: 'El enlace ya no es válido. Si necesitas darte de baja, escríbenos.',
        })
      }
    } catch {
      setState({
        kind: 'done',
        variant: 'error',
        message: 'Se ha producido un error. Vuelve a intentarlo en unos minutos.',
      })
    }
  }

  return (
    <PublicLanding title="Darse de baja">
      {state.kind === 'confirm' && (
        <>
          <p className="text-sm text-text-secondary">
            Vas a darte de baja de la newsletter. No recibirás más correos nuestros y añadiremos tu email a la lista de supresión para que no vuelva a añadirse en el futuro.
          </p>
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center justify-center px-4 py-3 rounded-md text-base font-medium bg-status-notEligible text-text-inverse hover:opacity-90"
          >
            Confirmar baja
          </button>
        </>
      )}
      {state.kind === 'sending' && (
        <ConfirmationCard variant="info" title="Procesando…" />
      )}
      {state.kind === 'done' && (
        <ConfirmationCard variant={state.variant} title="Hecho" description={state.message} />
      )}
    </PublicLanding>
  )
}
