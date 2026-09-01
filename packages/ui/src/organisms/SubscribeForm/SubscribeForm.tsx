import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { FormField } from '../../molecules/FormField'
import { Input } from '../../atoms/Input'
import type { SubscribeFormProps } from './SubscribeForm.types'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export function SubscribeForm({ onSubmit, privacyHref = '/privacy', testID }: SubscribeFormProps) {
  const [email, setEmail] = useState('')
  const [accept, setAccept] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !accept) return
    setState({ kind: 'sending' })
    try {
      const result = await onSubmit(email.trim().toLowerCase())
      if (result === 'ok') {
        setState({ kind: 'ok' })
        setEmail('')
        setAccept(false)
      } else {
        setState({ kind: 'error', message: result.error })
      }
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }

  if (state.kind === 'ok') {
    return (
      <div
        data-testid={testID}
        className="p-6 rounded-lg bg-status-eligible/10 border border-status-eligible/30"
      >
        <h3 className="text-lg font-semibold text-status-eligible mb-2">
          Revisa tu correo
        </h3>
        <p className="text-sm text-text-secondary">
          Si el email es correcto, recibirás un enlace de confirmación en unos
          minutos. Debes pulsarlo para completar la suscripción.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} data-testid={testID} className="flex flex-col gap-4">
      <FormField label="Email" required>
        <Input value={email} onChange={setEmail} type="email" placeholder="tu@correo.com" testID="subscribe-email" />
      </FormField>

      {/* Honeypot: campo oculto que los bots suelen rellenar */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value=""
        onChange={() => {}}
        className="hidden"
        aria-hidden
      />

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-1"
          data-testid="subscribe-accept"
        />
        <span className="text-sm text-text-secondary">
          Acepto recibir la newsletter y he leído la{' '}
          <a href={privacyHref} className="text-brand-600 underline">
            política de privacidad
          </a>
          . Puedo darme de baja en cualquier momento.
        </span>
      </label>

      <button
        type="submit"
        disabled={state.kind === 'sending' || !email.trim() || !accept}
        data-testid="subscribe-submit"
        className={clsx(
          'inline-flex items-center justify-center px-4 py-3 rounded-md text-base font-medium',
          'bg-brand-500 text-text-inverse transition-colors hover:bg-brand-600 active:bg-brand-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {state.kind === 'sending' ? 'Enviando…' : 'Suscribirme'}
      </button>

      {state.kind === 'error' && (
        <p className="text-sm text-status-notEligible" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
