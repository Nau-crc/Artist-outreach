import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Badge, Button, Input } from '@artist-outreach/ui/atoms'
import { Card, FormField } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import {
  api,
  ApiError,
  type ExtractReport,
  type RobotsCheckResult,
  type WebSource,
} from '@/lib/api'

type RobotsState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; result: RobotsCheckResult }
  | { kind: 'error'; message: string }

type ExtractState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; report: ExtractReport }
  | { kind: 'error'; message: string }

export default function SourceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [source, setSource] = useState<WebSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [authorizationRef, setAuthorizationRef] = useState('')
  const [complianceNotes, setComplianceNotes] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [robots, setRobots] = useState<RobotsState>({ kind: 'idle' })

  const [maxPages, setMaxPages] = useState('50')
  const [maxDepth, setMaxDepth] = useState('2')
  const [extract, setExtract] = useState<ExtractState>({ kind: 'idle' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setSource(await api.getWebSource(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function submitVerify() {
    if (!authorizationRef.trim() || !complianceNotes.trim()) return
    setVerifying(true)
    try {
      const updated = await api.verifyWebSource(id, {
        authorizationRef: authorizationRef.trim(),
        complianceNotes: complianceNotes.trim(),
      })
      setSource(updated)
      setAuthorizationRef('')
      setComplianceNotes('')
    } catch (err) {
      Alert.alert('No se pudo verificar', err instanceof ApiError ? err.message : String(err))
    } finally {
      setVerifying(false)
    }
  }

  async function submitUnverify() {
    Alert.prompt?.(
      'Revertir verificación',
      'Escribe el motivo (queda registrado en auditoría).',
      async (reason) => {
        if (!reason?.trim()) return
        try {
          const updated = await api.unverifyWebSource(id, reason.trim())
          setSource(updated)
        } catch (err) {
          Alert.alert('Error', err instanceof ApiError ? err.message : String(err))
        }
      },
    )
  }

  async function checkRobots() {
    setRobots({ kind: 'checking' })
    try {
      setRobots({ kind: 'ok', result: await api.checkWebSourceRobots(id) })
    } catch (err) {
      setRobots({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) })
    }
  }

  async function runExtract() {
    const pages = Number(maxPages)
    const depth = Number(maxDepth)
    if (!Number.isFinite(pages) || pages < 1) return
    if (!Number.isFinite(depth) || depth < 0) return
    setExtract({ kind: 'running' })
    try {
      const report = await api.extractFromWebSource(id, { maxPages: pages, maxDepth: depth })
      setExtract({ kind: 'ok', report })
    } catch (err) {
      setExtract({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) })
    }
  }

  const config = (source?.config ?? {}) as { startUrl?: string; host?: string }

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title={source?.name ?? 'Fuente'}
        subtitle={config?.host ?? undefined}
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

        {source && (
          <>
            <Card>
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold">Estado</Text>
                  <Badge
                    tone={
                      source.complianceStatus === 'VERIFIED'
                        ? 'success'
                        : source.complianceStatus === 'PROHIBITED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {source.complianceStatus === 'VERIFIED'
                      ? 'Verificada'
                      : source.complianceStatus === 'PROHIBITED'
                        ? 'Prohibida'
                        : 'Sin verificar'}
                  </Badge>
                </View>
                {config?.startUrl && (
                  <Text className="text-xs font-mono text-text-muted">{config.startUrl}</Text>
                )}
                {source.complianceNotes && (
                  <Text className="text-xs text-text-secondary" selectable>
                    {source.complianceNotes}
                  </Text>
                )}
                {source.termsUrl && (
                  <Text className="text-xs text-brand-600 underline" selectable>
                    {source.termsUrl}
                  </Text>
                )}
              </View>
            </Card>

            {source.complianceStatus !== 'VERIFIED' && (
              <Card>
                <View className="gap-3">
                  <Text className="text-base font-semibold">Verificar autorización LOPD</Text>
                  <Text className="text-xs text-text-muted">
                    Registra la referencia del documento (contrato, email, expediente) que autoriza
                    a tratar los datos, y una descripción breve de la base legal.
                  </Text>
                  <FormField label="Referencia de autorización" required>
                    <Input
                      value={authorizationRef}
                      onChange={setAuthorizationRef}
                      placeholder="contrato-042, expediente-2026-Q3…"
                    />
                  </FormField>
                  <FormField label="Notas de cumplimiento" required>
                    <Input
                      value={complianceNotes}
                      onChange={setComplianceNotes}
                      multiline
                      rows={4}
                      placeholder="Base legal, alcance, restricciones…"
                    />
                  </FormField>
                  <Button
                    onPress={submitVerify}
                    disabled={verifying || !authorizationRef.trim() || !complianceNotes.trim()}
                  >
                    {verifying ? 'Verificando…' : 'Marcar como verificada'}
                  </Button>
                </View>
              </Card>
            )}

            {source.complianceStatus === 'VERIFIED' && (
              <Card>
                <View className="gap-2">
                  <Text className="text-base font-semibold">Ya está verificada</Text>
                  <Text className="text-xs text-text-muted">
                    Si expira la autorización o la entidad la revoca, revierte a "Sin verificar".
                  </Text>
                  <Button variant="danger" onPress={submitUnverify}>
                    Revertir verificación
                  </Button>
                </View>
              </Card>
            )}

            <Card>
              <View className="gap-2">
                <Text className="text-base font-semibold">robots.txt</Text>
                <Text className="text-xs text-text-muted">
                  Comprueba en vivo si nuestro user-agent puede acceder a la URL raíz.
                </Text>
                <Button onPress={checkRobots} disabled={robots.kind === 'checking'}>
                  {robots.kind === 'checking' ? 'Consultando…' : 'Chequear robots.txt'}
                </Button>
                {robots.kind === 'ok' && (
                  <View className="p-3 rounded-md bg-surface-subtle gap-1">
                    <Text className={robots.result.allowed ? 'text-status-eligible' : 'text-status-notEligible'}>
                      {robots.result.allowed ? '✓ Permitido' : '✗ Bloqueado'} — {robots.result.reason}
                    </Text>
                    {robots.result.crawlDelayMs > 0 && (
                      <Text className="text-xs text-text-muted">
                        Crawl-delay: {robots.result.crawlDelayMs} ms
                      </Text>
                    )}
                    <Text className="text-xs text-text-muted font-mono">{robots.result.robotsUrl}</Text>
                  </View>
                )}
                {robots.kind === 'error' && (
                  <Text className="text-status-notEligible text-sm">{robots.message}</Text>
                )}
              </View>
            </Card>

            <Card>
              <View className="gap-3">
                <Text className="text-base font-semibold">Ejecutar extracción</Text>
                {source.complianceStatus !== 'VERIFIED' && (
                  <Text className="text-xs text-status-reviewRequired">
                    Debes verificar la autorización antes de poder ejecutar la extracción.
                  </Text>
                )}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <FormField label="Máx. páginas" hint="1–500">
                      <Input value={maxPages} onChange={setMaxPages} />
                    </FormField>
                  </View>
                  <View className="flex-1">
                    <FormField label="Máx. profundidad" hint="0–5">
                      <Input value={maxDepth} onChange={setMaxDepth} />
                    </FormField>
                  </View>
                </View>
                <Button
                  onPress={runExtract}
                  disabled={extract.kind === 'running' || source.complianceStatus !== 'VERIFIED'}
                >
                  {extract.kind === 'running' ? 'Extrayendo…' : 'Ejecutar extracción'}
                </Button>

                {extract.kind === 'ok' && (
                  <View className="p-3 rounded-md bg-status-eligible/10 border border-status-eligible/30 gap-2">
                    <Text className="text-status-eligible font-semibold">Extracción completada</Text>
                    <SummaryRow label="Páginas visitadas" value={extract.report.crawl.visitedCount} />
                    <SummaryRow label="Emails encontrados" value={extract.report.crawl.emailsCount} />
                    <SummaryRow label="Nuevos contactos" value={extract.report.persisted.newContactsCount} />
                    <SummaryRow label="Duplicados" value={extract.report.persisted.duplicates.length} />
                    <SummaryRow label="Auto-suprimidos" value={extract.report.persisted.suppressed} />
                    {extract.report.crawl.aborted && (
                      <Text className="text-status-notEligible text-xs">
                        Abortada: {extract.report.crawl.abortReason}
                      </Text>
                    )}
                    <VisitedPagesList pages={extract.report.crawl.pages} />
                    <View className="flex-row gap-2 pt-2">
                      <Button size="sm" variant="secondary" onPress={() => router.push('/review')}>
                        Ver cola de revisión
                      </Button>
                    </View>
                  </View>
                )}

                {extract.kind === 'error' && (
                  <Text className="text-status-notEligible text-sm">{extract.message}</Text>
                )}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text className="text-sm font-semibold text-text-primary">{value}</Text>
    </View>
  )
}

function statusLabel(status: number | 'skipped_robots' | 'error'): { text: string; tone: string } {
  if (status === 'skipped_robots') return { text: 'robots.txt', tone: 'text-status-reviewRequired' }
  if (status === 'error') return { text: 'error', tone: 'text-status-notEligible' }
  if (typeof status === 'number') {
    if (status >= 200 && status < 300) return { text: `${status}`, tone: 'text-status-eligible' }
    return { text: `${status}`, tone: 'text-status-notEligible' }
  }
  return { text: String(status), tone: 'text-text-muted' }
}

function VisitedPagesList({
  pages,
}: {
  pages: Array<{ url: string; depth: number; status: number | 'skipped_robots' | 'error'; emailsFound: number; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  if (pages.length === 0) return null
  return (
    <View className="mt-2 gap-2">
      <Button size="sm" variant="ghost" onPress={() => setOpen((v) => !v)}>
        {open ? 'Ocultar páginas visitadas' : `Ver páginas visitadas (${pages.length})`}
      </Button>
      {open && (
        <View className="gap-1 p-2 rounded-md bg-surface-base border border-border-subtle">
          {pages.map((p) => {
            const s = statusLabel(p.status)
            return (
              <View key={`${p.url}-${p.depth}`} className="gap-0.5 py-1 border-b border-border-subtle">
                <View className="flex-row justify-between gap-2">
                  <Text className={`text-xs font-mono ${s.tone}`}>{s.text}</Text>
                  <Text className="text-xs text-text-muted">
                    prof {p.depth} · {p.emailsFound} email{p.emailsFound === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text className="text-xs font-mono text-text-primary" numberOfLines={2} selectable>
                  {p.url}
                </Text>
                {p.error && (
                  <Text className="text-xs text-status-notEligible" numberOfLines={2}>
                    {p.error}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
