import nativewindPreset from 'nativewind/preset'
import tokensPreset from '@artist-outreach/config/tailwind'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [nativewindPreset, tokensPreset],
}
