import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Badge, Button } from '@artist-outreach/ui/atoms'
import { Card, EmptyState } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type WebSource } from '@/lib/api'

const COMPLIANCE_TONE = {
  VERIFIED: 'success',
  UNVERIFIED: 'warning',
  PROHIBITED: 'danger',
} as const

const COMPLIANCE_LABEL = {
  VERIFIED: 'Verificada',
  UNVERIFIED: 'Sin verificar',
  PROHIBITED: 'Prohibida',
} as const

export default function SourcesScreen() {
  const router = useRouter()
  const [items, setItems] = useState<WebSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listWebSources())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Fuentes web"
        subtitle={`${items.length} registrada${items.length === 1 ? '' : 's'}`}
        trailing={
          <View className="flex-row gap-2">
            <Button size="sm" onPress={() => router.push('/sources/new')}>
              Registrar
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
          title="Sin fuentes registradas"
          description="Registra la URL que te ha autorizado la entidad. Nada se extrae hasta que verifiques con la referencia jurídica."
          action={<Button onPress={() => router.push('/sources/new')}>Registrar una</Button>}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => {
            const config = item.config as { startUrl?: string; host?: string }
            return (
              <Card onPress={() => router.push(`/sources/${item.id}`)}>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold flex-1">{item.name}</Text>
                    <Badge tone={COMPLIANCE_TONE[item.complianceStatus]}>
                      {COMPLIANCE_LABEL[item.complianceStatus]}
                    </Badge>
                  </View>
                  {config?.startUrl && (
                    <Text className="text-xs text-text-muted font-mono" numberOfLines={1}>
                      {config.startUrl}
                    </Text>
                  )}
                </View>
              </Card>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}
