import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { Card, EmptyState } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import {
  api,
  ApiError,
  type CsvCommitReport,
  type CsvColumnMapping,
  type CsvPreviewResult,
} from '@/lib/api'

type Phase =
  | { kind: 'edit' }
  | { kind: 'analyzing' }
  | { kind: 'preview'; result: CsvPreviewResult }
  | { kind: 'importing' }
  | { kind: 'done'; report: CsvCommitReport }
  | { kind: 'error'; message: string; previous: Phase }

const DOMAIN_FIELDS: Array<{ key: keyof CsvColumnMapping; label: string; required?: boolean }> = [
  { key: 'artistName', label: 'Nombre del artista', required: true },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Web' },
  { key: 'discipline', label: 'Disciplina' },
  { key: 'country', label: 'País (ISO)' },
  { key: 'city', label: 'Ciudad' },
  { key: 'language', label: 'Idioma' },
]

export default function ImportCsvScreen() {
  const router = useRouter()
  const [csvText, setCsvText] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' })
  const [mapping, setMapping] = useState<Partial<CsvColumnMapping>>({})

  async function analyze() {
    if (!csvText.trim()) return
    setPhase({ kind: 'analyzing' })
    try {
      const result = await api.previewCsv(csvText)
      setMapping({ ...result.suggestedMapping, ...mapping })
      setPhase({ kind: 'preview', result })
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof ApiError ? `${err.status}: ${err.message}` : String(err),
        previous: { kind: 'edit' },
      })
    }
  }

  async function commit() {
    if (phase.kind !== 'preview') return
    if (!mapping.artistName) {
      Alert.alert('Falta mapping', 'Marca qué columna contiene el nombre del artista.')
      return
    }
    const previous = phase
    setPhase({ kind: 'importing' })
    try {
      const report = await api.commitCsv(csvText, mapping as CsvColumnMapping)
      setPhase({ kind: 'done', report })
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof ApiError ? `${err.status}: ${err.message}` : String(err),
        previous,
      })
    }
  }

  function reset() {
    setCsvText('')
    setMapping({})
    setPhase({ kind: 'edit' })
  }

  function updateMapping(field: keyof CsvColumnMapping, header: string | undefined) {
    setMapping((prev) => {
      if (header === undefined) {
        const next = { ...prev }
        delete next[field]
        return next
      }
      return { ...prev, [field]: header }
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Importar CSV"
        subtitle="Sube contactos desde una lista propia"
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Atrás
          </Button>
        }
      />

      <ScrollView contentContainerClassName="p-4 gap-4">
        {(phase.kind === 'edit' || phase.kind === 'analyzing') && (
          <>
            <Card variant="muted">
              <Text className="text-sm text-text-secondary">
                Pega el contenido del CSV. Primera línea debe contener los nombres de las columnas.
                Máx. 5 MB / 5000 filas. Los emails inválidos se descartan silenciosamente.
                Contactos sin email quedarán en revisión con emailStatus=NOT_FOUND.
              </Text>
            </Card>

            <TextInput
              value={csvText}
              onChangeText={setCsvText}
              multiline
              placeholder={'artist,email,country\nAna Luz,ana@example.com,ES\nDiego,diego@example.com,CL'}
              placeholderTextColor="#8B8B95"
              className="min-h-[240px] p-3 rounded-md border border-border-subtle bg-surface-base text-text-primary font-mono text-sm"
              textAlignVertical="top"
            />

            <Button
              onPress={analyze}
              disabled={phase.kind === 'analyzing' || !csvText.trim()}
              testID="analyze"
            >
              {phase.kind === 'analyzing' ? 'Analizando…' : 'Analizar CSV'}
            </Button>
          </>
        )}

        {phase.kind === 'preview' && (
          <>
            <Card>
              <Text className="text-base font-semibold text-text-primary mb-2">Resumen</Text>
              <View className="gap-1">
                <SummaryRow label="Filas detectadas" value={phase.result.totalRows} />
                <SummaryRow label="Válidas" value={phase.result.validRows} tone="success" />
                <SummaryRow label="Inválidas" value={phase.result.invalidRows} tone={phase.result.invalidRows > 0 ? 'warning' : 'muted'} />
                <SummaryRow label="Columnas" value={phase.result.detectedHeaders.length} />
              </View>
            </Card>

            <Card>
              <Text className="text-base font-semibold text-text-primary mb-2">Mapeo de columnas</Text>
              <Text className="text-xs text-text-muted mb-3">
                Toca un campo para cambiar la columna asignada.
              </Text>
              <View className="gap-2">
                {DOMAIN_FIELDS.map((field) => (
                  <MappingRow
                    key={field.key}
                    field={field}
                    headers={phase.result.detectedHeaders}
                    current={mapping[field.key]}
                    onChange={(header) => updateMapping(field.key, header)}
                  />
                ))}
              </View>
              {!mapping.artistName && (
                <Text className="text-xs text-status-notEligible mt-2">
                  Falta asignar la columna del nombre del artista.
                </Text>
              )}
            </Card>

            <Card variant="muted">
              <Text className="text-sm font-semibold text-text-primary mb-2">Primeras filas</Text>
              <View className="gap-1">
                {phase.result.rows.slice(0, 10).map((row) => (
                  <PreviewRow key={row.index} row={row} />
                ))}
              </View>
            </Card>

            <View className="gap-2">
              <Button onPress={commit} disabled={!mapping.artistName} testID="commit">
                Importar {phase.result.validRows} filas
              </Button>
              <Button variant="ghost" onPress={reset}>
                Empezar de nuevo
              </Button>
            </View>
          </>
        )}

        {phase.kind === 'importing' && (
          <View className="items-center py-12 gap-2">
            <ActivityIndicator />
            <Text className="text-text-secondary">Importando contactos…</Text>
          </View>
        )}

        {phase.kind === 'done' && (
          <>
            <EmptyState
              title="Importación completa"
              description={`${phase.report.newContactsCount} nuevos · ${phase.report.duplicates.length} duplicados · ${phase.report.suppressed} suprimidos automáticamente`}
            />
            <View className="gap-2">
              <Button onPress={() => router.push('/review')}>Ir a la cola de revisión</Button>
              <Button variant="secondary" onPress={reset}>Importar otro CSV</Button>
            </View>
          </>
        )}

        {phase.kind === 'error' && (
          <>
            <Card variant="muted">
              <Text className="text-status-notEligible">{phase.message}</Text>
            </Card>
            <Button onPress={() => setPhase(phase.previous)}>Volver</Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'success' | 'warning' | 'muted' | 'neutral'
}) {
  const color = {
    success: 'text-status-eligible',
    warning: 'text-status-reviewRequired',
    muted: 'text-text-muted',
    neutral: 'text-text-primary',
  }[tone]
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text className={`text-sm font-semibold ${color}`}>{value}</Text>
    </View>
  )
}

function MappingRow({
  field,
  headers,
  current,
  onChange,
}: {
  field: { key: keyof CsvColumnMapping; label: string; required?: boolean }
  headers: string[]
  current: string | undefined
  onChange: (header: string | undefined) => void
}) {
  const options = [undefined, ...headers]
  return (
    <View className="gap-1">
      <Text className="text-xs font-medium text-text-secondary">
        {field.label}
        {field.required ? <Text className="text-status-notEligible"> *</Text> : null}
      </Text>
      <View className="flex-row flex-wrap gap-1">
        {options.map((opt, idx) => {
          const selected = current === opt
          return (
            <Button
              key={`${field.key}-${idx}`}
              size="sm"
              variant={selected ? 'primary' : 'secondary'}
              onPress={() => onChange(opt)}
            >
              {opt ?? '—'}
            </Button>
          )
        })}
      </View>
    </View>
  )
}

function PreviewRow({ row }: { row: { index: number; raw: Record<string, string>; errors: string[] } }) {
  const summary = Object.entries(row.raw)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ')
  const invalid = row.errors.length > 0
  return (
    <View className="flex-row gap-2">
      <Text className={invalid ? 'text-status-notEligible' : 'text-status-eligible'}>
        {invalid ? '✗' : '✓'}
      </Text>
      <Text className="flex-1 text-xs text-text-secondary" numberOfLines={2}>
        {summary}
        {invalid ? `  — ${row.errors.join(', ')}` : ''}
      </Text>
    </View>
  )
}
