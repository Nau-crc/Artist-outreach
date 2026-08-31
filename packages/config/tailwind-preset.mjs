import { colors, radius, spacing, typography } from './tokens.mjs'

const px = (n) => `${n}px`

const preset = {
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
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, px(v)])),
      borderRadius: {
        none: px(radius.none),
        sm: px(radius.sm),
        md: px(radius.md),
        lg: px(radius.lg),
        xl: px(radius.xl),
        full: px(radius.full),
      },
      fontFamily: typography.fontFamily,
      fontSize: Object.fromEntries(
        Object.entries(typography.fontSize).map(([k, v]) => [k, px(v)]),
      ),
      lineHeight: typography.lineHeight,
      fontWeight: typography.fontWeight,
    },
  },
}

export default preset
