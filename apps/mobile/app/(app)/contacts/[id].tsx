import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@artist-outreach/ui/atoms'
import { Card, StatusPill } from '@artist-outreach/ui/molecules'
import { AppHeader } from '@artist-outreach/ui/organisms'
import { api, ApiError, type Contact, type EligibilityReport, type ReviewDecision } from '@/lib/api'

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [eligibility, setEligibility] = useState<EligibilityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

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
