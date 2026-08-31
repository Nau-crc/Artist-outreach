import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const here = import.meta.dirname

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
      '@app': resolve(here, 'app'),
    },
  },
})
