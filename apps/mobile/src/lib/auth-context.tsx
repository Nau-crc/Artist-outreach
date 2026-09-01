import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === 'true'

const FAKE_SESSION = {
  access_token: 'dev-bypass',
  refresh_token: 'dev-bypass',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'admin',
    email: 'dev@localhost',
    app_metadata: { role: 'admin' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
} as unknown as Session

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(DEV_BYPASS ? FAKE_SESSION : null)
  const [loading, setLoading] = useState(!DEV_BYPASS)

  useEffect(() => {
    if (DEV_BYPASS) return
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      async signInWithMagicLink(email) {
        if (DEV_BYPASS) return {}
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        })
        return error ? { error: error.message } : {}
      },
      async signOut() {
        if (DEV_BYPASS) {
          setSession(null)
          return
        }
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
