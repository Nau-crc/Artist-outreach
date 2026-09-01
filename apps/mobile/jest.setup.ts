// Mocks compartidos por todos los tests del móvil.
// Cada mock declara un módulo entero; jest lo intercepta antes de que RN /
// Expo intenten inicializar código nativo.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const React = require('react')

// ────────────────────────────────────────────────────────────────
// expo-constants — devuelve una URL de API por defecto en tests.
// ────────────────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { apiUrl: 'http://localhost:3000' },
    },
  },
  __esModule: true,
}))

// ────────────────────────────────────────────────────────────────
// expo-secure-store — en tests solo simulamos memoria.
// ────────────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {}
  return {
    getItemAsync: async (key: string) => store[key] ?? null,
    setItemAsync: async (key: string, value: string) => {
      store[key] = value
    },
    deleteItemAsync: async (key: string) => {
      delete store[key]
    },
    __esModule: true,
  }
})

// ────────────────────────────────────────────────────────────────
// @supabase/supabase-js — cliente en tests devuelve sesión vacía.
// ────────────────────────────────────────────────────────────────
jest.mock('@supabase/supabase-js', () => {
  const listeners: Array<(event: string, session: unknown) => void> = []
  return {
    createClient: () => ({
      auth: {
        async getSession() {
          return { data: { session: null }, error: null }
        },
        onAuthStateChange(cb: (event: string, session: unknown) => void) {
          listeners.push(cb)
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  const idx = listeners.indexOf(cb)
                  if (idx >= 0) listeners.splice(idx, 1)
                },
              },
            },
          }
        },
        async signInWithOtp() {
          return { data: {}, error: null }
        },
        async signOut() {
          return { error: null }
        },
      },
    }),
    __esModule: true,
  }
})

// ────────────────────────────────────────────────────────────────
// react-native-url-polyfill — no-op en Node.
// ────────────────────────────────────────────────────────────────
jest.mock('react-native-url-polyfill/auto', () => ({}))

// ────────────────────────────────────────────────────────────────
// expo-router — stubs mínimos: Link / Redirect / useRouter / etc.
// ────────────────────────────────────────────────────────────────
jest.mock('expo-router', () => {
  return {
    Link: ({ children }: { children: unknown }) => children,
    Redirect: () => null,
    Stack: ({ children }: { children: unknown }) => children,
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    __esModule: true,
  }
})
