// Fase 1: preset node minimalista — solo verifica que Jest arranca.
// Fase 2 (cuando testeemos componentes RN reales) migramos a jest-expo
// con sus setups (expo-constants mock, RN mocks, transform whitelist para pnpm, etc.).
//
// configFile: false + babelrc: false evita que babel-jest cargue el babel.config.js
// del proyecto (que está pensado para Metro/Expo y trae plugins de RN incompatibles
// en el runtime de Node de Jest).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
