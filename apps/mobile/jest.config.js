// jest-expo — preset completo para testear componentes React Native.
//
// Ajustes clave:
//   - transformIgnorePatterns con soporte para .pnpm/ nesting.
//     El path real bajo pnpm es
//     node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...
//     El pattern permite un prefijo .pnpm/... opcional antes del paquete.
//   - setupFiles carga mocks de expo-constants, expo-secure-store,
//     @supabase/supabase-js y expo-router para tests unitarios de componentes.

const rnPackages = [
  '(?:jest-)?react-native',
  '@react-native(?:-community)?',
  '@react-native/[^/]+',
  'expo(?:nent)?',
  'expo-[^/]+',
  '@expo(?:nent)?/[^/]+',
  '@expo-google-fonts/[^/]+',
  '@artist-outreach/[^/]+',
  'nativewind',
  'react-native-css-interop',
  'react-native-url-polyfill',
  'react-native-worklets',
]

const transformIgnorePatterns = [
  `node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:${rnPackages.join('|')})/)`,
]

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns,
}
