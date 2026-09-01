import { Email } from '@artist-outreach/shared'
import type { DiscoveryResult } from '@artist-outreach/shared'

/**
 * Normaliza un DiscoveryResult crudo: recorta strings, valida email,
 * uppercase country. Devuelve `null` si el resultado es inutilizable
 * (sin artistName). Los emails inválidos NO invalidan el resultado —
 * se descartan y el emailStatus quedará como INVALID/NOT_FOUND al persistir.
 */
export function normalize(raw: DiscoveryResult): DiscoveryResult | null {
  const artistName = raw.artistName?.trim()
  if (!artistName) return null

  const email = normalizeEmail(raw.email)
  const website = raw.website?.trim() || null
  const discipline = raw.discipline?.trim() || null
  const country = raw.country ? raw.country.trim().toUpperCase() : null
  const city = raw.city?.trim() || null
  const language = raw.language?.trim() || null

  return {
    artistName,
    email,
    website,
    discipline,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    city,
    language,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    discoveredAt: raw.discoveredAt,
    raw: raw.raw,
  }
}

function normalizeEmail(input: string | null | undefined): string | null {
  if (input === undefined || input === null) return null
  const trimmed = input.trim()
  if (trimmed === '') return null
  const parsed = Email.safeParse(trimmed)
  return parsed.success ? parsed.email.value : null
}
