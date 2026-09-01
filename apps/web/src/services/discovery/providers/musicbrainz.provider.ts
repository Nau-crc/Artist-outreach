import type {
  ComplianceCheck,
  DiscoveryResult,
  DiscoverySearchParams,
} from '@artist-outreach/shared'
import type { DiscoveryProvider } from '../discovery.provider'
import { normalize } from '../normalize'

// ────────────────────────────────────────────────────────────────
// Términos de uso de MusicBrainz (verificados 2026-08-31):
//   - API pública: https://musicbrainz.org/doc/MusicBrainz_API
//   - Licencia CC0 para metadatos; uso comercial permitido.
//   - Rate limit: 1 req/segundo por IP anónima. Requiere User-Agent
//     identificable (nombre/versión/contacto).
//   - NO devuelve emails privados. Solo metadatos: nombre, país,
//     disciplina (tags), URLs oficiales.
//
// Este adapter solo pide metadatos. Emails quedan NOT_FOUND.
// El humano que revise puede completar el email desde fuentes propias
// o directamente en el CRM (no lo scrapeamos).
// ────────────────────────────────────────────────────────────────

const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ??
  'ArtistOutreachCRM/0.1 (contact-email-not-configured)'
const BASE_URL = 'https://musicbrainz.org/ws/2'
const MIN_INTERVAL_MS = 1100

let lastCallAt = 0

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastCallAt
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed))
  }
  lastCallAt = Date.now()
}

interface MusicBrainzArtist {
  id: string
  name: string
  country?: string
  area?: { name?: string; type?: string }
  'begin-area'?: { name?: string }
  disambiguation?: string
  tags?: Array<{ name: string; count?: number }>
}

interface MusicBrainzResponse {
  artists?: MusicBrainzArtist[]
}

function buildQuery(params: DiscoverySearchParams): string {
  const parts: string[] = []
  if (params.keywords && params.keywords.length > 0) {
    for (const kw of params.keywords) {
      parts.push(`artist:${escape(kw)}`)
    }
  }
  if (params.country) parts.push(`country:${escape(params.country.toUpperCase())}`)
  if (params.discipline) parts.push(`tag:${escape(params.discipline)}`)
  return parts.length > 0 ? parts.join(' AND ') : '*'
}

function escape(v: string): string {
  return v.replace(/["\\]/g, '\\$&').replace(/\s+/g, ' ').trim()
}

function pickDiscipline(artist: MusicBrainzArtist): string | null {
  if (!artist.tags || artist.tags.length === 0) return null
  const first = [...artist.tags].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]
  return first?.name ?? null
}

function toResult(artist: MusicBrainzArtist): DiscoveryResult {
  const raw: DiscoveryResult = {
    artistName: artist.name,
    email: null,
    website: null,
    discipline: pickDiscipline(artist),
    country: artist.country ?? null,
    city: artist['begin-area']?.name ?? artist.area?.name ?? null,
    language: null,
    source: 'musicbrainz',
    sourceUrl: `https://musicbrainz.org/artist/${artist.id}`,
    discoveredAt: new Date().toISOString(),
    raw: artist,
  }
  return normalize(raw) ?? raw
}

export const musicbrainzProvider: DiscoveryProvider = {
  slug: 'musicbrainz',
  name: 'MusicBrainz (metadatos)',
  type: 'API',
  requiresApiKey: false,
  async isCompliant(): Promise<ComplianceCheck> {
    // El User-Agent debe llevar contacto real. Si no está configurado,
    // marcamos UNVERIFIED para bloquear el uso.
    const hasContact = /contact:|mailto:|@/.test(USER_AGENT)
    if (!hasContact) {
      return {
        status: 'UNVERIFIED',
        checkedAt: new Date().toISOString(),
        notes:
          'Configura MUSICBRAINZ_USER_AGENT con un contacto real antes de usar este provider.',
      }
    }
    return {
      status: 'VERIFIED',
      checkedAt: new Date().toISOString(),
      notes:
        'API pública de MusicBrainz, licencia CC0 para metadatos, rate limit 1req/s respetado.',
    }
  },
  async search(params: DiscoverySearchParams): Promise<DiscoveryResult[]> {
    const query = buildQuery(params)
    const limit = Math.min(params.maxResults, 100)
    const url = `${BASE_URL}/artist?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`

    await waitForRateLimit()
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`MusicBrainz ${res.status}: ${await res.text()}`)
    }
    const body = (await res.json()) as MusicBrainzResponse
    const artists = body.artists ?? []
    return artists.slice(0, limit).map(toResult)
  },
}
