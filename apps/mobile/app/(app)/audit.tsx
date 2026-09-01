import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { EmptyState } from '@artist-outreach/ui/molecules'
import { AppHeader, AuditEntry } from '@artist-outreach/ui/organisms'
import { api, ApiError, type AuditLog } from '@/lib/api'

export default function AuditScreen() {
  const router = useRouter()
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listAudit({ limit: 100 }))
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err))
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
        title="Auditoría"
        subtitle={`${items.length} entrada${items.length === 1 ? '' : 's'}`}
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Atrás
          </Button>
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
        <EmptyState title="Sin entradas" description="Las acciones del sistema aparecerán aquí." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerClassName="px-4"
          renderItem={({ item }) => <AuditEntry entry={item} />}
        />
      )}
    </SafeAreaView>
  )
}
