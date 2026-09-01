import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '../../atoms/Button'
import { FormField } from '../../molecules/FormField'
import { Input } from '../../atoms/Input'
import type { SubscribeFormProps } from './SubscribeForm.types'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export function SubscribeForm({ onSubmit, testID }: SubscribeFormProps) {
  const [email, setEmail] = useState('')
  const [accept, setAccept] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit() {
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
      <View
        testID={testID}
        className="p-6 rounded-lg bg-status-eligible/10 border border-status-eligible/30"
      >
        <Text className="text-lg font-semibold text-status-eligible mb-2">Revisa tu correo</Text>
        <Text className="text-sm text-text-secondary">
          Si el email es correcto, recibirás un enlace de confirmación.
        </Text>
      </View>
    )
  }

  return (
    <View testID={testID} className="gap-4">
      <FormField label="Email" required>
        <Input value={email} onChange={setEmail} type="email" placeholder="tu@correo.com" testID="subscribe-email" />
      </FormField>

      <Pressable
        onPress={() => setAccept(!accept)}
        className="flex-row items-start gap-2"
        testID="subscribe-accept"
      >
        <View
          className={`w-4 h-4 mt-1 rounded-sm border ${
            accept ? 'bg-brand-500 border-brand-500' : 'border-border-strong'
          }`}
        />
        <Text className="flex-1 text-sm text-text-secondary">
          Acepto recibir la newsletter y la política de privacidad.
        </Text>
      </Pressable>

      <Button onPress={submit} disabled={state.kind === 'sending' || !email.trim() || !accept} testID="subscribe-submit">
        {state.kind === 'sending' ? 'Enviando…' : 'Suscribirme'}
      </Button>

      {state.kind === 'error' && (
        <Text className="text-sm text-status-notEligible">{state.message}</Text>
      )}
    </View>
  )
}
