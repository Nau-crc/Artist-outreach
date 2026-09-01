import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Input, Badge } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type SimulationResult } from '@/lib/api'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; result: SimulationResult }
  | { kind: 'error'; message: string }

export default function SimulateScreen() {
  const router = useRouter()
  const [limit, setLimit] = useState('50')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function run() {
    const n = Number(limit)
    if (!Number.isFinite(n) || n < 1) return
    setState({ kind: 'loading' })
    try {
      const result = await api.simulateConsentRequests({ limit: n })
      setState({ kind: 'ok', result })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) })
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title="Simular elegibilidad"
        subtitle="Dry-run del motor. No crea nada, no envía nada."
        trailing={
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Atrás
          </Button>
        }
      />

      <ScrollView contentContainerClassName="p-4 gap-4">
        <Card>
          <View className="gap-3">
            <FormField label="Contactos a evaluar" hint="Máx. 200">
              <Input value={limit} onChange={setLimit} />
            </FormField>
            <Button onPress={run} disabled={state.kind === 'loading'}>
              {state.kind === 'loading' ? 'Evaluando…' : 'Ejecutar'}
            </Button>
          </View>
        </Card>

        {state.kind === 'loading' && (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        )}

        {state.kind === 'error' && (
          <Text className="text-status-notEligible">{state.message}</Text>
        )}

        {state.kind === 'ok' && (
          <>
            <Card>
              <View className="gap-2">
                <Text className="text-base font-semibold">Resumen</Text>
                <SummaryRow label="Evaluados" value={state.result.totalEvaluated} />
                <SummaryRow label="Elegibles" value={state.result.eligible} tone="success" />
                <SummaryRow
                  label="No elegibles"
                  value={state.result.notEligible}
                  tone={state.result.notEligible > 0 ? 'warning' : 'muted'}
                />
                <SummaryRow
                  label="Suprimidos"
                  value={state.result.suppressed}
                  tone={state.result.suppressed > 0 ? 'danger' : 'muted'}
                />
              </View>
            </Card>

            {Object.keys(state.result.reasonsBreakdown).length > 0 && (
              <Card variant="muted">
                <Text className="text-base font-semibold mb-2">Motivos de rechazo</Text>
                <View className="gap-1">
                  {Object.entries(state.result.reasonsBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <View key={reason} className="flex-row justify-between">
                        <Text className="text-sm text-text-secondary">{reason}</Text>
                        <Text className="text-sm font-medium">{count}</Text>
                      </View>
                    ))}
                </View>
              </Card>
            )}

            <Card variant="muted">
              <Text className="text-base font-semibold mb-2">Muestra ({state.result.sample.length})</Text>
              <View className="gap-2">
                {state.result.sample.map((c) => (
                  <View key={c.contactId} className="flex-row gap-2 items-start">
                    <Badge tone={c.eligible ? 'success' : 'warning'}>
                      {c.eligible ? '✓' : '✗'}
                    </Badge>
                    <View className="flex-1">
                      <Text className="text-sm">{c.artistName}</Text>
                      {c.email && <Text className="text-xs font-mono text-text-muted">{c.email}</Text>}
                      {c.failingRules.length > 0 && (
                        <Text className="text-xs text-status-notEligible">
                          {c.failingRules.join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
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
  tone?: 'success' | 'warning' | 'danger' | 'muted' | 'neutral'
}) {
  const color = {
    success: 'text-status-eligible',
    warning: 'text-status-reviewRequired',
    danger: 'text-status-notEligible',
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
