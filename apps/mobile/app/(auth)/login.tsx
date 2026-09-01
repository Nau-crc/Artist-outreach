import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { FormField } from '@artist-outreach/ui/molecules'
import { Input } from '@artist-outreach/ui/atoms'
import { useAuth } from '@/lib/auth-context'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

export default function LoginScreen() {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function submit() {
    if (!email.trim()) return
    setStatus({ kind: 'sending' })
    const { error } = await signInWithMagicLink(email.trim().toLowerCase())
    if (error) setStatus({ kind: 'error', message: error })
    else setStatus({ kind: 'sent' })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-md gap-6">
            <View className="gap-2">
              <Text className="text-3xl font-semibold text-text-primary">Artist Outreach</Text>
              <Text className="text-base text-text-secondary">
                Panel interno. Introduce tu email y te enviaremos un enlace de acceso.
              </Text>
            </View>

            <FormField label="Email" required>
              <Input
                value={email}
                onChange={setEmail}
                placeholder="tu@correo.com"
                type="email"
                testID="login-email"
              />
            </FormField>

            <Button
              onPress={submit}
              disabled={status.kind === 'sending' || !email.trim()}
              testID="login-submit"
            >
              {status.kind === 'sending' ? 'Enviando…' : 'Enviar enlace'}
            </Button>

            {status.kind === 'sent' && (
              <View className="p-4 rounded-md bg-status-eligible/15">
                <Text className="text-status-eligible text-sm">
                  Revisa tu bandeja de entrada. Toca el enlace en tu teléfono para entrar.
                </Text>
              </View>
            )}

            {status.kind === 'error' && (
              <View className="p-4 rounded-md bg-status-notEligible/15">
                <Text className="text-status-notEligible text-sm">{status.message}</Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
