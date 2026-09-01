import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { EmptyState } from '@artist-outreach/ui/molecules'
import { AppHeader, ContactCard } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Contact } from '@/lib/api'

export default function ReviewScreen() {
  const router = useRouter()
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listContacts({ contactStatus: 'REVIEW_REQUIRED', limit: 100 })
      setItems(data)
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
        title="Cola de revisión"
        subtitle={`${items.length} pendiente${items.length === 1 ? '' : 's'}`}
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
        <EmptyState
          title="Nada por revisar"
          description="Cuando lleguen nuevos contactos aparecerán aquí."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => (
            <ContactCard contact={item} onPress={(id) => router.push(`/contacts/${id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  )
}
