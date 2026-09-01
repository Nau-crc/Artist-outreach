import 'react-native-url-polyfill/auto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === 'true'

const secureStorage = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value)
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key)
  },
}

function createStub(): SupabaseClient {
  const noop = () => Promise.resolve({ data: null, error: null })
  return {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null }
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      async signInWithOtp() {
        return { data: {}, error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
    from: () => ({ select: noop, insert: noop, update: noop, delete: noop }),
  } as unknown as SupabaseClient
}

function createRealClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

export const supabase: SupabaseClient = (() => {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    return createRealClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  if (DEV_BYPASS || process.env.NODE_ENV === 'test') {
    return createStub()
  }
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY no están definidos. Devolviendo cliente stub — el login no funcionará hasta que los configures o actives EXPO_PUBLIC_DEV_BYPASS_AUTH=true.',
  )
  return createStub()
})()
