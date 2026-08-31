import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const here = import.meta.dirname
loadEnv({ path: resolve(here, '../../.env') })
loadEnv({ path: resolve(here, '.env') })
loadEnv({ path: resolve(here, '.env.test'), override: true })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: true,
    // Los tests de integración comparten una única DB local — los ejecutamos serialmente
    // para evitar carreras entre `truncateAll()` de suites distintas.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
      '@app': resolve(here, 'app'),
    },
  },
})
