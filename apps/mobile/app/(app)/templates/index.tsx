import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Badge } from '@artist-outreach/ui/atoms'
import { Card, EmptyState } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Template } from '@/lib/api'

export default function TemplatesScreen() {
  const router = useRouter()
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listTemplates())
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
        title="Plantillas"
        subtitle={`${items.length} plantilla${items.length === 1 ? '' : 's'}`}
        trailing={
          <View className="flex-row gap-2">
            <Button size="sm" onPress={() => router.push('/templates/new')} testID="new-template">
              Nueva
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
          title="Sin plantillas"
          description="Crea la primera plantilla para poder encolar solicitudes de consentimiento."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/templates/${item.id}`)}>
              <View className="gap-2">
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-semibold text-text-primary flex-1">{item.name}</Text>
                  <Badge tone={item.active ? 'success' : 'muted'}>
                    {item.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </View>
                <Text className="text-sm text-text-secondary" numberOfLines={1}>
                  {item.subject}
                </Text>
                <Text className="text-xs text-text-muted">
                  v{item.version} · actualizada {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  )
}
