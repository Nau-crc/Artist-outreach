import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input } from '@artist-outreach/ui/atoms'
import { FormField } from '@artist-outreach/ui/molecules'
import { useAuth } from '@/lib/auth-context'
import { supabaseMode } from '@/lib/supabase'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; message: string }

export default function LoginScreen() {
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function submit() {
    if (!email.trim() || !password) return
    setStatus({ kind: 'sending' })
    const { error } = await signInWithPassword(email.trim().toLowerCase(), password)
    if (error) {
      const friendly = error.toLowerCase().includes('invalid login credentials')
        ? 'Email o contraseña incorrectos.'
        : error
      setStatus({ kind: 'error', message: friendly })
    } else {
      // La redirección la hace el layout al ver la sesión activa.
      setStatus({ kind: 'idle' })
    }
  }

  const canSubmit = email.trim() && password && status.kind !== 'sending'
  const clientMisconfigured = supabaseMode === 'stub-missing-config'

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
                Accede con tu email y contraseña.
              </Text>
            </View>

            {clientMisconfigured && (
              <View className="p-4 rounded-md bg-status-notEligible/15">
                <Text className="text-status-notEligible text-sm">
                  Este build no tiene la configuración de autenticación. Contacta con el
                  administrador.
                </Text>
              </View>
            )}

            <FormField label="Email" required>
              <Input
                value={email}
                onChange={setEmail}
                placeholder="tu@correo.com"
                type="email"
                testID="login-email"
              />
            </FormField>

            <FormField label="Contraseña" required>
              <Input
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                type="password"
                testID="login-password"
              />
            </FormField>

            <Button
              onPress={submit}
              disabled={!canSubmit || clientMisconfigured}
              testID="login-submit"
            >
              {status.kind === 'sending' ? 'Entrando…' : 'Entrar'}
            </Button>

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
