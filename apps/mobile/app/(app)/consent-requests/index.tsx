import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Badge } from '@artist-outreach/ui/atoms'
import { Card, EmptyState } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type ConsentRequest } from '@/lib/api'

const STATUS_TONE = {
  PENDING: 'warning',
  SENT: 'success',
  FAILED: 'danger',
  CANCELLED: 'muted',
} as const

export default function ConsentRequestsScreen() {
  const router = useRouter()
  const [items, setItems] = useState<ConsentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listConsentRequests({ limit: 100 }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function cancel(r: ConsentRequest) {
    Alert.alert('Cancelar solicitud', `¿Cancelar la solicitud a ${r.contact?.artistName}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelConsentRequest(r.id)
            await load()
          } catch (err) {
            Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Solicitudes de consentimiento"
        subtitle={`${items.length} en cola · envío outbound desactivado en fase 5`}
        trailing={
          <View className="flex-row gap-2">
            <Button size="sm" variant="secondary" onPress={() => router.push('/consent-requests/simulate')}>
              Simular
            </Button>
            <Button variant="ghost" size="sm" onPress={() => router.back()}>
              Atrás
            </Button>
          </View>
        }
      />

      {loading ? (
        <View className="items-center py-12">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="px-4 gap-2">
          <Text className="text-status-notEligible">{error}</Text>
          <Button size="sm" onPress={load}>Reintentar</Button>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin solicitudes"
          description="Aún no has encolado ninguna. En fase 5 la cola queda parada sin enviar; en fase 6 se activará tras validación jurídica."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => (
            <Card>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-base font-semibold flex-1">
                    {item.contact?.artistName ?? item.contactId.slice(0, 8)}
                  </Text>
                  <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                </View>
                {item.contact?.email && (
                  <Text className="text-xs text-text-muted font-mono">{item.contact.email}</Text>
                )}
                <Text className="text-xs text-text-secondary">
                  Campaña: {item.campaign?.name ?? '—'} · Plantilla: {item.template?.name} v{item.template?.version}
                </Text>
                <Text className="text-xs text-text-muted">
                  Creada {new Date(item.createdAt).toLocaleString()}
                  {item.sentAt ? ` · Enviada ${new Date(item.sentAt).toLocaleString()}` : ''}
                </Text>
                {item.status === 'PENDING' && (
                  <Button size="sm" variant="secondary" onPress={() => cancel(item)}>
                    Cancelar
                  </Button>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  )
}
