import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input, Badge } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Template } from '@/lib/api'

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; subject: string; text: string; html: string; version: number }
  | { kind: 'error'; message: string }

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [t, setT] = useState<Template | null>(null)
  const [draft, setDraft] = useState<Partial<Template>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const template = await api.getTemplate(id)
      setT(template)
      setDraft({})
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function save() {
    if (!t || Object.keys(draft).length === 0) return
    setSaving(true)
    try {
      const updated = await api.updateTemplate(t.id, draft)
      setT(updated)
      setDraft({})
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

  async function runPreview() {
    if (!t) return
    setPreview({ kind: 'loading' })
    try {
      const p = await api.previewTemplate(t.id, {})
      setPreview({ kind: 'ok', ...p })
    } catch (err) {
      setPreview({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) })
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

            <FormField label="Nombre">
              <Input
                value={draft.name ?? t.name}
                onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              />
            </FormField>
            <FormField label="Asunto">
              <Input
                value={draft.subject ?? t.subject}
                onChange={(v) => setDraft((d) => ({ ...d, subject: v }))}
              />
            </FormField>
            <FormField label="Texto plano">
              <Input
                value={draft.bodyText ?? t.bodyText}
                onChange={(v) => setDraft((d) => ({ ...d, bodyText: v }))}
              />
            </FormField>
            <FormField label="HTML" hint="Cambios en subject/HTML/texto suben la versión.">
              <Input
                value={draft.bodyHtml ?? t.bodyHtml}
                onChange={(v) => setDraft((d) => ({ ...d, bodyHtml: v }))}
              />
            </FormField>

            <View className="gap-2">
              <Button onPress={save} disabled={saving || Object.keys(draft).length === 0}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              <Button variant="secondary" onPress={runPreview}>
                Ver preview
              </Button>
              <Button variant="danger" onPress={remove}>
                Eliminar
              </Button>
            </View>

            {preview.kind === 'loading' && <ActivityIndicator />}
            {preview.kind === 'error' && (
              <Text className="text-status-notEligible">{preview.message}</Text>
            )}
            {preview.kind === 'ok' && (
              <Card variant="muted">
                <View className="gap-2">
                  <Badge tone="brand">v{preview.version}</Badge>
                  <Text className="text-base font-semibold">{preview.subject}</Text>
                  <Text className="text-sm text-text-secondary">{preview.text}</Text>
                  <Text className="text-xs text-text-muted mt-2">HTML:</Text>
                  <Text className="text-xs font-mono text-text-muted" selectable>
                    {preview.html}
                  </Text>
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
