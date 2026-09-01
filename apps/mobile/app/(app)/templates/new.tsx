import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError } from '@/lib/api'
import { fillPreviewVars, textToHtml } from '@/lib/text-to-html'

const DEFAULT_BODY = `Hola {{ artistName }},

Somos [nombre del proyecto] y estamos creando una newsletter para artistas centrada en comunicación. Enviamos contenidos prácticos, breves y periódicos.

Si te interesa recibirla, confirma tu suscripción aquí:
{{ confirmUrl }}

Si prefieres que no volvamos a escribirte, puedes ignorar este correo.

Gracias.`

export default function NewTemplateScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('Hola {{ artistName }}')
  const [bodyText, setBodyText] = useState(DEFAULT_BODY)
  const [saving, setSaving] = useState(false)

  const previewSubject = useMemo(() => fillPreviewVars(subject), [subject])
  const previewText = useMemo(() => fillPreviewVars(bodyText), [bodyText])

  async function save() {
    if (!name.trim() || !subject.trim() || !bodyText.trim()) return
    setSaving(true)
    try {
      const bodyHtml = textToHtml(bodyText)
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
        <FormField label="Nombre interno" required hint="Solo se ve en el panel — no aparece en el email.">
          <Input value={name} onChange={setName} placeholder="Solicitud v1" />
        </FormField>
        <FormField label="Asunto" required hint="Puedes usar {{ artistName }}.">
          <Input value={subject} onChange={setSubject} />
        </FormField>
        <FormField
          label="Cuerpo del mensaje"
          required
          hint="Escribe en texto normal. Deja una línea en blanco para separar párrafos. El HTML se genera solo."
        >
          <Input value={bodyText} onChange={setBodyText} multiline rows={14} />
        </FormField>

        <Card variant="muted">
          <Text className="text-xs text-text-muted uppercase mb-2">Vista previa</Text>
          <Text className="text-base font-semibold text-text-primary mb-3">{previewSubject}</Text>
          {previewText.split(/\n{2,}/).map((p, i) => (
            <Text key={i} className="text-sm text-text-primary mb-3 leading-6">
              {p}
            </Text>
          ))}
        </Card>

        <Button onPress={save} disabled={saving || !name.trim()} testID="save">
          {saving ? 'Guardando…' : 'Crear plantilla'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}
