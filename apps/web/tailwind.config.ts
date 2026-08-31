import type { Config } from 'tailwindcss'
// @ts-expect-error — .mjs sin tipos, es un preset simple de Tailwind
import preset from '@artist-outreach/config/tailwind'

const config: Config = {
  presets: [preset as Config],
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
}

export default config
