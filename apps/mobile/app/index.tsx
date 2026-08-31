import { useEffect, useState } from 'react'
import { SafeAreaView, Text, View } from 'react-native'
import { Button } from '@artist-outreach/ui/atoms'
import { checkHealth } from '@/lib/api'

type HealthState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; time: string } | { kind: 'error'; message: string }

export default function HomeScreen() {
  const [health, setHealth] = useState<HealthState>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    setHealth({ kind: 'loading' })
    checkHealth()
      .then((r) => {
        if (!cancelled) setHealth({ kind: 'ok', time: r.time })
      })
      .catch((err) => {
        if (!cancelled) setHealth({ kind: 'error', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-surface-base">
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md space-y-6">
          <Text className="text-3xl font-semibold text-text-primary text-center">
            Artist Outreach
          </Text>
          <Text className="text-base text-text-secondary text-center">
            CRM interno — fase 1
          </Text>

          <View className="p-4 rounded-md bg-surface-subtle">
            <Text className="text-sm text-text-muted mb-2">Backend</Text>
            {health.kind === 'idle' && <Text>—</Text>}
            {health.kind === 'loading' && <Text>Comprobando...</Text>}
            {health.kind === 'ok' && (
              <Text className="text-status-eligible" testID="health-ok">
                OK — {health.time}
              </Text>
            )}
            {health.kind === 'error' && (
              <Text className="text-status-notEligible" testID="health-error">
                Sin conexión: {health.message}
              </Text>
            )}
          </View>

          <Button onPress={() => setHealth({ kind: 'idle' })} testID="reset-button">
            Reset
          </Button>
        </View>
      </View>
    </SafeAreaView>
  )
}
