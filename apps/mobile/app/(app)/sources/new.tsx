import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError } from '@/lib/api'

export default function NewSourceScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  const [termsUrl, setTermsUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !url.trim()) return
    setSaving(true)
    try {
      const s = await api.createWebSource({
        name: name.trim(),
        url: url.trim(),
        ...(termsUrl.trim() ? { termsUrl: termsUrl.trim() } : {}),
        ...(notes.trim() ? { complianceNotes: notes.trim() } : {}),
      })
      router.replace(`/sources/${s.id}`)
    } catch (err) {
      Alert.alert('No se pudo registrar', err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Registrar fuente"
        subtitle="Nueva URL autorizada por la entidad LOPD"
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Cancelar
          </Button>
        }
      />

      <ScrollView contentContainerClassName="p-4 gap-4">
        <Card variant="muted">
          <Text className="text-sm text-text-secondary">
            La fuente se crea en estado{' '}
            <Text className="font-semibold text-status-reviewRequired">Sin verificar</Text>. No se
            podrá extraer nada hasta que la verifiques con la referencia jurídica de la
            autorización.
          </Text>
        </Card>

        <FormField label="Nombre interno" required hint="Cómo la llamas en el panel.">
          <Input value={name} onChange={setName} placeholder="Entidad X — artistas 2026" />
        </FormField>
        <FormField label="URL raíz" required hint="Desde esta URL empieza el crawler.">
          <Input value={url} onChange={setUrl} placeholder="https://entidad.example/artistas" type="url" />
        </FormField>
        <FormField label="URL de términos" hint="Si la entidad tiene una página con las condiciones de uso.">
          <Input value={termsUrl} onChange={setTermsUrl} placeholder="https://entidad.example/legal" type="url" />
        </FormField>
        <FormField label="Notas iniciales" hint="Contexto sobre la fuente (no la autorización, esa va al verificar).">
          <Input value={notes} onChange={setNotes} multiline rows={5} />
        </FormField>

        <Button onPress={save} disabled={saving || !name.trim() || !url.trim()}>
          {saving ? 'Registrando…' : 'Registrar fuente'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}
