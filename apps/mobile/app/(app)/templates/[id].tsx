import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input, Badge } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Template } from '@/lib/api'
import { fillPreviewVars, textToHtml } from '@/lib/text-to-html'
import { VariableChips, appendVariable } from '@/components/VariableChips'

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [t, setT] = useState<Template | null>(null)
  const [subjectDraft, setSubjectDraft] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const template = await api.getTemplate(id)
      setT(template)
      setSubjectDraft(null)
      setTextDraft(null)
      setNameDraft(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const currentSubject = subjectDraft ?? t?.subject ?? ''
  const currentText = textDraft ?? t?.bodyText ?? ''
  const currentName = nameDraft ?? t?.name ?? ''

  const previewSubject = useMemo(() => fillPreviewVars(currentSubject), [currentSubject])
  const previewParagraphs = useMemo(
    () => fillPreviewVars(currentText).split(/\n{2,}/),
    [currentText],
  )

  const dirty =
    (nameDraft !== null && nameDraft !== t?.name) ||
    (subjectDraft !== null && subjectDraft !== t?.subject) ||
    (textDraft !== null && textDraft !== t?.bodyText)

  async function save() {
    if (!t || !dirty) return
    setSaving(true)
    try {
      const patch: Record<string, string> = {}
      if (nameDraft !== null && nameDraft !== t.name) patch.name = nameDraft
      if (subjectDraft !== null && subjectDraft !== t.subject) patch.subject = subjectDraft
      if (textDraft !== null && textDraft !== t.bodyText) {
        patch.bodyText = textDraft
        patch.bodyHtml = textToHtml(textDraft)
      }
      const updated = await api.updateTemplate(t.id, patch)
      setT(updated)
      setSubjectDraft(null)
      setTextDraft(null)
      setNameDraft(null)
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(next: boolean) {
    if (!t) return
    try {
      const updated = await api.updateTemplate(t.id, { active: next })
      setT(updated)
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
    }
  }

  async function remove() {
    if (!t) return
    Alert.alert('Eliminar plantilla', 'Solo si no está en uso por solicitudes.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTemplate(t.id)
            router.back()
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
        title={t?.name ?? 'Plantilla'}
        subtitle={t ? `v${t.version} · ${t.active ? 'activa' : 'inactiva'}` : undefined}
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Atrás
          </Button>
        }
      />

      <ScrollView contentContainerClassName="p-4 gap-4">
        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        )}
        {error && <Text className="text-status-notEligible">{error}</Text>}

        {t && (
          <>
            <Card>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold">Activa</Text>
                  <Switch value={t.active} onValueChange={toggleActive} />
                </View>
                <Text className="text-xs text-text-muted">
                  Solo se pueden encolar solicitudes con plantillas activas.
                </Text>
              </View>
            </Card>

            <FormField label="Nombre interno">
              <Input value={currentName} onChange={setNameDraft} />
            </FormField>

            <FormField label="Asunto">
              <Input value={currentSubject} onChange={setSubjectDraft} />
            </FormField>
            <VariableChips
              target="subject"
              onInsert={(v) => setSubjectDraft(appendVariable(currentSubject, v))}
            />

            <FormField
              label="Cuerpo del mensaje"
              hint="Deja una línea en blanco para separar párrafos. Cambios en el contenido suben la versión."
            >
              <Input value={currentText} onChange={setTextDraft} multiline rows={14} />
            </FormField>
            <VariableChips
              target="body"
              onInsert={(v) => setTextDraft(appendVariable(currentText, v))}
            />

            <View className="flex-row items-center gap-2 mt-4">
              <Text className="text-xs text-text-muted uppercase">Vista previa</Text>
              <Badge tone="brand">v{t.version}{dirty ? '+1' : ''}</Badge>
            </View>
            <Card variant="muted">
              <View className="gap-2">
                <Text className="text-base font-semibold text-text-primary">{previewSubject}</Text>
                <View className="pt-2">
                  {previewParagraphs.map((p, i) => (
                    <Text key={i} className="text-sm text-text-primary mb-3 leading-6 whitespace-pre-wrap">
                      {p}
                    </Text>
                  ))}
                </View>
              </View>
            </Card>

            <View className="gap-2">
              <Button onPress={save} disabled={saving || !dirty}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              <Button variant="danger" onPress={remove}>
                Eliminar
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
