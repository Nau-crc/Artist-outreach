import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/lib/auth-context'

export default function AuthLayout() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-base">
        <ActivityIndicator />
      </View>
    )
  }
  if (session) return <Redirect href="/dashboard" />
  return <Stack screenOptions={{ headerShown: false }} />
}
