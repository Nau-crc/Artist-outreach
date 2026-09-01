import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { EmptyState, SearchBar } from '@artist-outreach/ui/molecules'
import { AppHeader, ContactCard } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Contact } from '@/lib/api'

export default function ContactsScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(q: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listContacts({ search: q || undefined, limit: 100 })
      setItems(data)
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load('')
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Contactos"
        subtitle={`${items.length} resultado${items.length === 1 ? '' : 's'}`}
        trailing={
          <View className="flex-row gap-2">
            <Button variant="secondary" size="sm" onPress={() => router.push('/contacts/import')} testID="import-csv">
              Importar CSV
            </Button>
            <Button variant="ghost" size="sm" onPress={() => router.back()}>
              Atrás
            </Button>
          </View>
        }
      />
      <View className="p-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Nombre, email, ciudad…" />
      </View>

      {loading && items.length === 0 ? (
        <View className="items-center py-12">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="px-4">
          <Text className="text-status-notEligible">{error}</Text>
          <Button size="sm" onPress={() => load(search)}>Reintentar</Button>
        </View>
      ) : items.length === 0 ? (
        <EmptyState title="Sin resultados" description="Prueba con otra búsqueda." />
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
