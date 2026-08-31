import Constants from 'expo-constants'

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000'

export interface HealthResponse {
  status: string
  service: string
  version: string
  time: string
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return (await res.json()) as HealthResponse
}
