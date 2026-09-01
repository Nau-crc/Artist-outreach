import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { Button } from '@artist-outreach/ui/atoms'
import { Card, StatusPill } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import {
  api,
  ApiError,
  type Campaign,
  type Contact,
  type EligibilityReport,
  type ReviewDecision,
  type Template,
} from '@/lib/api'

// ────────────────────────────────────────────────────────────────
// Enqueue sub-panel state
// ────────────────────────────────────────────────────────────────

type EnqueueState =
  | { kind: 'closed' }
  | { kind: 'open'; campaigns: Campaign[]; templates: Template[]; loading: false }
  | { kind: 'loading' }
  | { kind: 'sending' }
  | { kind: 'done'; ok: true; requestId: string }
  | { kind: 'done'; ok: false; reasons: string[] }
  | { kind: 'error'; message: string }

const REASON_LABELS: Record<string, string> = {
  email_present: 'Falta email',
  email_valid: 'Email no es válido',
  email_status_ok: 'Estado del email no permite envío',
  consent_unknown: 'Ya tiene una solicitud o consentimiento previos',
  permission_eligible: 'No ha sido marcado como elegible',
  not_suppressed: 'El email está en la lista de supresión',
  campaign_inactive: 'La campaña no está activa',
}

function reasonLabel(id: string): string {
  if (REASON_LABELS[id]) return REASON_LABELS[id]!
  if (id.startsWith('consent_status:')) {
    return `Consentimiento en estado ${id.replace('consent_status:', '')}`
  }
  return id
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [eligibility, setEligibility] = useState<EligibilityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [enqueue, setEnqueue] = useState<EnqueueState>({ kind: 'closed' })
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [c, e] = await Promise.all([api.getContact(id), api.dryRunEligibility(id)])
      setContact(c)
      setEligibility(e)
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function act(decision: ReviewDecision) {
    setActing(true)
    try {
      await api.reviewContact(id, decision)
      await load()
    } catch (err) {
      Alert.alert('No se pudo aplicar', err instanceof ApiError ? err.message : String(err))
    } finally {
      setActing(false)
    }
  }

  async function openEnqueue() {
    setEnqueue({ kind: 'loading' })
    try {
      const [campaigns, templates] = await Promise.all([
        api.listCampaigns({ active: true }),
        api.listTemplates({ active: true }),
      ])
      setEnqueue({ kind: 'open', campaigns, templates, loading: false })
      setSelectedCampaign(campaigns.length === 1 ? campaigns[0]!.id : null)
      setSelectedTemplate(templates.length === 1 ? templates[0]!.id : null)
    } catch (err) {
      setEnqueue({
        kind: 'error',
        message: err instanceof ApiError ? err.message : String(err),
      })
    }
  }

  async function confirmEnqueue() {
    if (!selectedCampaign || !selectedTemplate) return
    setEnqueue({ kind: 'sending' })
    try {
      const result = await api.enqueueConsentRequest({
        contactId: id,
        campaignId: selectedCampaign,
        templateId: selectedTemplate,
      })
      if (result.status === 'ENQUEUED') {
        setEnqueue({ kind: 'done', ok: true, requestId: result.request!.id })
        await load()
      } else {
        setEnqueue({ kind: 'done', ok: false, reasons: result.reasons ?? [] })
      }
    } catch (err) {
      setEnqueue({
        kind: 'error',
        message: err instanceof ApiError ? err.message : String(err),
      })
    }
  }

  const canEnqueue =
    contact !== null &&
    contact.contactStatus === 'REVIEWED' &&
    contact.permission === 'ELIGIBLE' &&
    contact.consentStatus === 'UNKNOWN' &&
    contact.email !== null

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <AppHeader
        title={contact?.artistName ?? 'Contacto'}
        subtitle={contact?.email ?? undefined}
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

        {contact && (
          <>
            <Card variant="default">
              <View className="gap-2">
                <Row label="Disciplina" value={contact.discipline} />
                <Row label="Localidad" value={[contact.city, contact.country].filter(Boolean).join(' · ')} />
                <Row label="Web" value={contact.website} />
                <Row label="Idioma" value={contact.language} />
                {contact.notes && <Row label="Notas" value={contact.notes} />}
              </View>
            </Card>

            <View className="flex-row flex-wrap gap-2">
              <StatusPill kind="contact" value={contact.contactStatus} />
              <StatusPill kind="email" value={contact.emailStatus} />
              <StatusPill kind="consent" value={contact.consentStatus} />
              <StatusPill kind="permission" value={contact.permission} />
            </View>

            {eligibility && (
              <Card variant="muted">
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  Elegibilidad (dry-run): {eligibility.eligible ? 'ELEGIBLE' : 'NO ELEGIBLE'}
                </Text>
                <View className="gap-1">
                  {eligibility.rules.map((r) => (
                    <View key={r.id} className="flex-row gap-2">
                      <Text className={r.passed ? 'text-status-eligible' : 'text-status-notEligible'}>
                        {r.passed ? '✓' : '✗'}
                      </Text>
                      <Text className="flex-1 text-sm text-text-secondary">
                        {r.description}
                        {r.detail ? ` — ${r.detail}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {contact.contactStatus === 'REVIEW_REQUIRED' && (
              <View className="gap-2">
                <Button onPress={() => act({ kind: 'APPROVE' })} disabled={acting} testID="approve">
                  Aprobar
                </Button>
                <Button variant="secondary" onPress={() => act({ kind: 'DISCARD' })} disabled={acting} testID="discard">
                  Descartar
                </Button>
                <Button variant="danger" onPress={() => act({ kind: 'SUPPRESS' })} disabled={acting} testID="suppress">
                  Suprimir
                </Button>
              </View>
            )}

            {/* ── Enqueue consent request panel ────────────────── */}

            <Card>
              <View className="gap-3">
                <Text className="text-base font-semibold text-text-primary">
                  Solicitud de consentimiento
                </Text>

                {!canEnqueue && enqueue.kind === 'closed' && (
                  <Text className="text-xs text-text-muted">
                    {contact.contactStatus !== 'REVIEWED'
                      ? 'El contacto debe estar aprobado (REVIEWED).'
                      : contact.permission !== 'ELIGIBLE'
                      ? 'El contacto no está marcado como elegible.'
                      : contact.consentStatus !== 'UNKNOWN'
                      ? `Ya hay un consentimiento en estado ${contact.consentStatus}.`
                      : !contact.email
                      ? 'Falta email para poder enviar solicitud.'
                      : 'No cumple los requisitos actuales.'}
                  </Text>
                )}

                {canEnqueue && enqueue.kind === 'closed' && (
                  <>
                    <Text className="text-xs text-text-muted">
                      Encolar no envía nada. El envío outbound está desactivado en fase 5.
                    </Text>
                    <Button onPress={openEnqueue} testID="enqueue-open">
                      Encolar solicitud
                    </Button>
                  </>
                )}

                {enqueue.kind === 'loading' && (
                  <View className="items-center py-4">
                    <ActivityIndicator />
                  </View>
                )}

                {enqueue.kind === 'open' && (
                  <>
                    {enqueue.campaigns.length === 0 && (
                      <Text className="text-sm text-status-notEligible">
                        No hay campañas activas. Crea una en Campañas.
                      </Text>
                    )}
                    {enqueue.templates.length === 0 && (
                      <Text className="text-sm text-status-notEligible">
                        No hay plantillas activas. Crea una en Plantillas.
                      </Text>
                    )}

                    {enqueue.campaigns.length > 0 && (
                      <View className="gap-1">
                        <Text className="text-xs font-medium text-text-secondary">Campaña</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {enqueue.campaigns.map((c) => (
                            <Button
                              key={c.id}
                              size="sm"
                              variant={selectedCampaign === c.id ? 'primary' : 'secondary'}
                              onPress={() => setSelectedCampaign(c.id)}
                            >
                              {c.name}
                            </Button>
                          ))}
                        </View>
                      </View>
                    )}

                    {enqueue.templates.length > 0 && (
                      <View className="gap-1">
                        <Text className="text-xs font-medium text-text-secondary">Plantilla</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {enqueue.templates.map((t) => (
                            <Button
                              key={t.id}
                              size="sm"
                              variant={selectedTemplate === t.id ? 'primary' : 'secondary'}
                              onPress={() => setSelectedTemplate(t.id)}
                            >
                              {t.name} v{t.version}
                            </Button>
                          ))}
                        </View>
                      </View>
                    )}

                    <View className="gap-2 pt-2">
                      <Button
                        onPress={confirmEnqueue}
                        disabled={!selectedCampaign || !selectedTemplate}
                        testID="enqueue-confirm"
                      >
                        Confirmar y encolar
                      </Button>
                      <Button variant="ghost" onPress={() => setEnqueue({ kind: 'closed' })}>
                        Cancelar
                      </Button>
                    </View>
                  </>
                )}

                {enqueue.kind === 'sending' && (
                  <View className="items-center py-4">
                    <ActivityIndicator />
                    <Text className="text-xs text-text-muted mt-2">Encolando…</Text>
                  </View>
                )}

                {enqueue.kind === 'done' && enqueue.ok && (
                  <View className="gap-2 p-3 rounded-md bg-status-eligible/10 border border-status-eligible/30">
                    <Text className="text-status-eligible font-semibold text-sm">
                      Solicitud encolada en estado PENDING.
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      No se envía hasta que fase 6 active el envío outbound con validación jurídica.
                    </Text>
                    <View className="flex-row gap-2">
                      <Button size="sm" variant="secondary" onPress={() => router.push('/consent-requests')}>
                        Ver cola
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => setEnqueue({ kind: 'closed' })}>
                        Cerrar
                      </Button>
                    </View>
                  </View>
                )}

                {enqueue.kind === 'done' && !enqueue.ok && (
                  <View className="gap-2 p-3 rounded-md bg-status-reviewRequired/10 border border-status-reviewRequired/30">
                    <Text className="text-status-reviewRequired font-semibold text-sm">
                      No se pudo encolar. Motivos:
                    </Text>
                    <View className="gap-1">
                      {enqueue.reasons.map((r) => (
                        <Text key={r} className="text-xs text-text-secondary">
                          · {reasonLabel(r)}
                        </Text>
                      ))}
                    </View>
                    <Button size="sm" variant="ghost" onPress={() => setEnqueue({ kind: 'closed' })}>
                      Cerrar
                    </Button>
                  </View>
                )}

                {enqueue.kind === 'error' && (
                  <View className="gap-2 p-3 rounded-md bg-status-notEligible/10 border border-status-notEligible/30">
                    <Text className="text-status-notEligible font-semibold text-sm">Error</Text>
                    <Text className="text-xs text-text-secondary">{enqueue.message}</Text>
                    <Button size="sm" variant="ghost" onPress={() => setEnqueue({ kind: 'closed' })}>
                      Cerrar
                    </Button>
                  </View>
                )}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-xs text-text-muted uppercase">{label}</Text>
      <Text className="flex-1 text-right text-sm text-text-primary">{value}</Text>
    </View>
  )
}
