import type { Config } from 'tailwindcss'
import { colors, radius, spacing, typography } from './tokens'

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: colors.bg,
        surface: colors.surface,
        text: colors.text,
        brand: colors.brand,
        status: colors.status,
        border: colors.border,
      },
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`])),
      borderRadius: {
        none: `${radius.none}px`,
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        full: `${radius.full}px`,
      },
      fontFamily: typography.fontFamily,
      fontSize: Object.fromEntries(
        Object.entries(typography.fontSize).map(([k, v]) => [k, `${v}px`]),
      ),
      lineHeight: typography.lineHeight,
      fontWeight: typography.fontWeight,
    },
  },
}

export default preset
