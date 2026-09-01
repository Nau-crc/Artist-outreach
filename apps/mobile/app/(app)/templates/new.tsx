import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError } from '@/lib/api'
import { htmlToPlainText } from '@/lib/html-to-text'
import { fillPreviewVars } from '@/lib/text-to-html'
import { RichTextEditor } from '@/components/RichTextEditor'
import { VariableChips, appendVariable } from '@/components/VariableChips'
import { PreviewRenderer } from '@/components/PreviewRenderer'

const DEFAULT_HTML = `
<p>Hola <span class="tpl-var" data-variable="{{ artistName }}">{{ artistName }}</span>,</p>
<p>Somos [nombre del proyecto] y estamos creando una newsletter para artistas centrada en comunicación. Enviamos contenidos prácticos, breves y periódicos.</p>
<p>Si te interesa recibirla, pulsa el botón:</p>
<p style="text-align:center;margin:16px 0"><a class="tpl-cta" data-variable="{{ confirmUrl }}" data-label="Confirmar suscripción" href="{{ confirmUrl }}">Confirmar suscripción</a></p>
<p>Si prefieres que no volvamos a escribirte, puedes ignorar este correo.</p>
<p>Gracias.</p>
<p style="text-align:center;margin-top:16px"><a class="tpl-unsub" data-variable="{{ unsubscribeUrl }}" data-label="Darse de baja" href="{{ unsubscribeUrl }}">Darse de baja</a></p>
`.trim()

export default function NewTemplateScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('Hola {{ artistName }}')
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_HTML)
  const [saving, setSaving] = useState(false)

  const previewSubject = useMemo(() => fillPreviewVars(subject), [subject])
  const previewHtml = useMemo(() => fillPreviewVars(bodyHtml), [bodyHtml])

  async function save() {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) return
    setSaving(true)
    try {
      const bodyText = htmlToPlainText(bodyHtml)
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
        subtitle="Escribe con formato como en un correo normal. Los chips insertan variables."
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

        <FormField label="Asunto" required>
          <Input value={subject} onChange={setSubject} />
        </FormField>
        <VariableChips
          target="subject"
          onInsert={(v) => setSubject((prev) => appendVariable(prev, v))}
        />

        <FormField label="Cuerpo del mensaje" required>
          <RichTextEditor valueHtml={bodyHtml} onChangeHtml={setBodyHtml} testID="new-body" />
        </FormField>

        <Text className="text-xs text-text-muted uppercase mt-4">Vista previa</Text>
        <Card variant="muted">
          <View className="gap-2">
            <Text className="text-base font-semibold text-text-primary">{previewSubject}</Text>
            <PreviewRenderer html={previewHtml} />
          </View>
        </Card>

        <Button onPress={save} disabled={saving || !name.trim()} testID="save">
          {saving ? 'Guardando…' : 'Crear plantilla'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}
