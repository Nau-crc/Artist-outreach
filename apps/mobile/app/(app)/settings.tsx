import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { Input } from '@artist-outreach/ui/atoms'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type AppConfig } from '@/lib/api'

export default function SettingsScreen() {
  const router = useRouter()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setConfig(await api.getConfig())
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(patch: Partial<Pick<AppConfig, 'sendingEnabled' | 'campaignEnabled' | 'dailySendLimit' | 'hourlySendLimit' | 'minIntervalSeconds' | 'consentRequestCooldownDays'>>) {
    setSaving(true)
    try {
      setConfig(await api.updateConfig(patch))
    } catch (err) {
      Alert.alert('No se pudo guardar', err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleSending(next: boolean) {
    if (!config) return
    if (next) {
      // Enable requires typed confirmation.
      if (confirmText.trim().toUpperCase() !== 'ACTIVAR ENVIO') {
        Alert.alert(
          'Confirmación requerida',
          'Escribe exactamente "ACTIVAR ENVIO" en el campo de confirmación antes de activar.',
        )
        return
      }
      if (config.dailySendLimit === 0) {
        Alert.alert('Límite requerido', 'Sube el límite diario a > 0 antes de activar el envío.')
        return
      }
    }
    await save({ sendingEnabled: next })
    setConfirmText('')
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Ajustes"
        subtitle="Interruptores del sistema"
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Atrás
          </Button>
        }
      />

      <ScrollView contentContainerClassName="p-4 gap-4">
        {loading && (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        )}
        {error && <Text className="text-status-notEligible">{error}</Text>}

        {config && (
          <>
            <Card variant={config.sendingEnabled ? 'muted' : 'default'}>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-text-primary">
                    Envío outbound
                  </Text>
                  <Switch
                    value={config.sendingEnabled}
                    onValueChange={toggleSending}
                    disabled={saving}
                    testID="sending-toggle"
                  />
                </View>
                <Text className="text-sm text-text-secondary">
                  Cuando está desactivado, el sistema jamás llama al proveedor de email
                  para propósito CONSENT_REQUEST. Landings y confirmaciones siguen funcionando.
                </Text>
                {!config.sendingEnabled && (
                  <FormField
                    label='Escribe "ACTIVAR ENVIO" para habilitar'
                    hint="Este cambio queda registrado en el audit log."
                  >
                    <Input value={confirmText} onChange={setConfirmText} placeholder="ACTIVAR ENVIO" />
                  </FormField>
                )}
              </View>
            </Card>

            <Card>
              <Text className="text-base font-semibold text-text-primary mb-3">Límites</Text>
              <View className="gap-3">
                <NumberField
                  label="Límite diario"
                  value={config.dailySendLimit}
                  onChange={(n) => save({ dailySendLimit: n })}
                />
                <NumberField
                  label="Límite por hora"
                  value={config.hourlySendLimit}
                  onChange={(n) => save({ hourlySendLimit: n })}
                />
                <NumberField
                  label="Intervalo mínimo (segundos)"
                  value={config.minIntervalSeconds}
                  onChange={(n) => save({ minIntervalSeconds: n })}
                />
                <NumberField
                  label="Cooldown solicitud consentimiento (días)"
                  value={config.consentRequestCooldownDays}
                  onChange={(n) => save({ consentRequestCooldownDays: n })}
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  return (
    <FormField label={label}>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Input value={draft} onChange={setDraft} />
        </View>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            const n = Number(draft)
            if (Number.isFinite(n) && n >= 0) onChange(n)
          }}
        >
          Guardar
        </Button>
      </View>
    </FormField>
  )
}
