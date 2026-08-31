import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Excluye variantes RN — se testean en apps/mobile con Jest
    exclude: ['**/*.native.*', '**/node_modules/**'],
  },
})
