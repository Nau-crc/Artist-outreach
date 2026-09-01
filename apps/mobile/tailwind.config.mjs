import nativewindPreset from 'nativewind/preset'
import tokensPreset from '@artist-outreach/config/tailwind'

/** @type {import('tailwindcss').Config} */
export default {
  // NativeWind pide darkMode: 'class' en web (por defecto es 'media' y
  // react-native-css-interop no puede sincronizarse con eso).
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [nativewindPreset, tokensPreset],
}
