// Re-export desde el paquete de config (fuente única).
// El especifier "@artist-outreach/config/tokens" resuelve a tokens.mjs.
// @ts-expect-error — .mjs sin declaraciones de tipos; los objetos son inferidos.
export { colors, spacing, radius, typography } from '@artist-outreach/config/tokens'
