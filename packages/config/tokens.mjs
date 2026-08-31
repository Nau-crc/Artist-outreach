export const colors = {
  bg: {
    base: '#0B0B0F',
    subtle: '#141420',
    raised: '#1D1D2E',
  },
  surface: {
    base: '#FFFFFF',
    subtle: '#F5F5F7',
    muted: '#E7E7EC',
  },
  text: {
    primary: '#0B0B0F',
    secondary: '#4A4A55',
    inverse: '#FFFFFF',
    muted: '#8B8B95',
  },
  brand: {
    50: '#F0F1FF',
    100: '#DDE0FF',
    500: '#5B60F0',
    600: '#4A4EDB',
    700: '#3A3DB0',
  },
  status: {
    discovered: '#8B8B95',
    reviewRequired: '#F0A500',
    reviewed: '#4A4EDB',
    discarded: '#8B8B95',
    suppressed: '#B03A48',
    eligible: '#2E9E5B',
    notEligible: '#B03A48',
    blocked: '#B03A48',
    consentUnknown: '#8B8B95',
    consentRequested: '#F0A500',
    consentPending: '#F0A500',
    consentConfirmed: '#2E9E5B',
    consentWithdrawn: '#B03A48',
    emailFound: '#2E9E5B',
    emailNotFound: '#8B8B95',
    emailInvalid: '#B03A48',
    emailBounced: '#B03A48',
  },
  border: {
    subtle: '#E7E7EC',
    strong: '#B8B8C2',
  },
}

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
}

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
}

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.7,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}
