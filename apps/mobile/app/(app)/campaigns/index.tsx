import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input, Badge } from '@artist-outreach/ui/atoms'
import { Card, EmptyState, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Campaign } from '@/lib/api'

export default function CampaignsScreen() {
  const router = useRouter()
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listCampaigns())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.createCampaign({ name: newName })
      setNewName('')
      await load()
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  async function toggle(c: Campaign, next: boolean) {
    try {
      await api.updateCampaign(c.id, { active: next })
      await load()
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
    }
  }

  async function remove(c: Campaign) {
    Alert.alert('Eliminar campaña', `Solo si "${c.name}" no tiene solicitudes.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCampaign(c.id)
            await load()
          } catch (err) {
            Alert.alert('No se pudo eliminar', err instanceof ApiError ? err.message : String(err))
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Campañas"
        subtitle={`${items.length} campaña${items.length === 1 ? '' : 's'}`}
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Atrás
          </Button>
        }
      />

      <View className="px-4 pt-4 gap-3">
        <FormField label="Nueva campaña">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input value={newName} onChange={setNewName} placeholder="Nombre" />
            </View>
            <Button size="sm" onPress={create} disabled={creating || !newName.trim()}>
              Crear
            </Button>
          </View>
        </FormField>
      </View>

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
        <EmptyState title="Sin campañas" description="Crea la primera arriba." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => (
            <Card>
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold flex-1">{item.name}</Text>
                  <Badge tone={item.active ? 'success' : 'muted'}>
                    {item.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-text-muted">
                    Creada {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                  <Switch value={item.active} onValueChange={(v) => toggle(item, v)} />
                </View>
                <Button variant="danger" size="sm" onPress={() => remove(item)}>
                  Eliminar
                </Button>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  )
}
