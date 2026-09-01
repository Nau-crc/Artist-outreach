import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input } from '@artist-outreach/ui/atoms'
import { FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError } from '@/lib/api'

export default function NewTemplateScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('Hola {{ artistName }}')
  const [bodyText, setBodyText] = useState(
    'Hola {{ artistName }},\n\nSomos ... y estamos preparando una newsletter para artistas...\n\nSi te interesa recibirla, confirma aquí: {{ confirmUrl }}\n\nSi no te interesa, ignora este mensaje.',
  )
  const [bodyHtml, setBodyHtml] = useState(
    '<p>Hola {{ artistName }},</p><p>Somos... y estamos preparando una newsletter para artistas...</p><p><a href="{{ confirmUrl }}">Confirmar interés</a></p>',
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !subject.trim() || !bodyText.trim() || !bodyHtml.trim()) return
    setSaving(true)
    try {
      const t = await api.createTemplate({ name, subject, bodyText, bodyHtml })
      router.replace(`/templates/${t.id}`)
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Nueva plantilla"
        subtitle="Variables: {{ artistName }}, {{ confirmUrl }}, {{ unsubscribeUrl }}"
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Cancelar
          </Button>
        }
      />

      <ScrollView contentContainerClassName="p-4 gap-4">
        <FormField label="Nombre" required>
          <Input value={name} onChange={setName} placeholder="Solicitud v1" />
        </FormField>
        <FormField label="Asunto" required hint="Usa {{ artistName }} para personalizar">
          <Input value={subject} onChange={setSubject} />
        </FormField>
        <FormField label="Cuerpo texto plano" required>
          <Input value={bodyText} onChange={setBodyText} />
        </FormField>
        <FormField label="Cuerpo HTML" required hint="Se snapshotea al encolar. Editar después no altera solicitudes pasadas.">
          <Input value={bodyHtml} onChange={setBodyHtml} />
        </FormField>
        <Button onPress={save} disabled={saving || !name.trim()} testID="save">
          {saving ? 'Guardando…' : 'Crear plantilla'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}
