import type { Config } from 'tailwindcss'
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
