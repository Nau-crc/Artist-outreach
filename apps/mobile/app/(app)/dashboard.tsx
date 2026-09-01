import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { Card } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type AppConfig, type Contact } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

interface DashboardData {
  config: AppConfig
  counts: Record<string, number>
}

function summarize(contacts: Contact[]): Record<string, number> {
  const c: Record<string, number> = {
    total: contacts.length,
    review_required: 0,
    reviewed: 0,
    eligible: 0,
    consent_confirmed: 0,
    suppressed: 0,
  }
  for (const contact of contacts) {
    if (contact.contactStatus === 'REVIEW_REQUIRED') c.review_required++
    if (contact.contactStatus === 'REVIEWED') c.reviewed++
    if (contact.permission === 'ELIGIBLE') c.eligible++
    if (contact.consentStatus === 'CONFIRMED') c.consent_confirmed++
    if (contact.contactStatus === 'SUPPRESSED') c.suppressed++
  }
  return c
}

export default function DashboardScreen() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ok'; data: DashboardData } | { kind: 'error'; message: string }>({ kind: 'loading' })

  async function load() {
    setState({ kind: 'loading' })
    try {
      const [config, contacts] = await Promise.all([api.getConfig(), api.listContacts({ limit: 200 })])
      setState({ kind: 'ok', data: { config, counts: summarize(contacts) } })
    } catch (err) {
      const message = err instanceof ApiError ? `${err.status}: ${err.message}` : String(err)
      setState({ kind: 'error', message })
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Dashboard"
        subtitle="Estado del CRM"
        trailing={
          <Button variant="ghost" size="sm" onPress={signOut} testID="logout">
            Salir
          </Button>
        }
      />
      <ScrollView contentContainerClassName="p-4 gap-3">
        {state.kind === 'loading' && (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        )}

        {state.kind === 'error' && (
          <Card variant="muted">
            <Text className="text-status-notEligible">{state.message}</Text>
            <View className="mt-2">
              <Button size="sm" onPress={load}>Reintentar</Button>
            </View>
          </Card>
        )}

        {state.kind === 'ok' && (
          <>
            <SendingBanner enabled={state.data.config.sendingEnabled} />

            <View className="gap-3">
              <Metric label="Contactos" value={state.data.counts.total} />
              <Metric label="Pendientes de revisión" value={state.data.counts.review_required} onPress={() => router.push('/review')} />
              <Metric label="Elegibles" value={state.data.counts.eligible} />
              <Metric label="Consentimiento confirmado" value={state.data.counts.consent_confirmed} />
              <Metric label="Suprimidos" value={state.data.counts.suppressed} />
            </View>

            <View className="gap-2 mt-4">
              <Button onPress={() => router.push('/contacts')}>Ver contactos</Button>
              <Button variant="secondary" onPress={() => router.push('/review')}>Cola de revisión</Button>
              <Button variant="ghost" onPress={() => router.push('/settings')}>Ajustes</Button>
              <Button variant="ghost" onPress={() => router.push('/audit')}>Auditoría</Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SendingBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null
  return (
    <View className="p-4 rounded-md bg-status-notEligible/15 border border-status-notEligible/30">
      <Text className="text-status-notEligible font-semibold">Envío outbound ACTIVADO</Text>
      <Text className="text-status-notEligible text-sm">
        Se están enviando solicitudes de consentimiento a contactos elegibles.
      </Text>
    </View>
  )
}

function Metric({
  label,
  value,
  onPress,
}: {
  label: string
  value: number
  onPress?: () => void
}) {
  return (
    <Card variant="default" onPress={onPress}>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-text-secondary">{label}</Text>
        <Text className="text-2xl font-semibold text-text-primary">{value}</Text>
      </View>
    </Card>
  )
}
