import * as cheerio from 'cheerio'
import { Email } from '@artist-outreach/shared'

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const MAILTO_REGEX = /^mailto:([^?]+)/i

// Emails de sistema que ignoramos siempre.
const BLOCKED_EMAILS = new Set([
  'example@example.com',
  'test@test.com',
  'noreply@',
  'no-reply@',
])

const BLOCKED_LOCALS = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'postmaster']

export interface ExtractedPage {
  url: string
  title: string | null
  artistName: string | null
  emails: string[]
  links: string[]
}

/**
 * Parsea una página HTML y extrae:
 * - Emails (regex + mailto: hrefs, deduplicados, filtrados por Email VO
 *   sintáctico y blocklist de emails de sistema).
 * - Título / og:title / h1 como candidato de artistName.
 * - Links absolutos al mismo dominio para el crawl.
 */
export function parsePage(html: string, url: string): ExtractedPage {
  const $ = cheerio.load(html)

  const title = $('title').first().text().trim() || null
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null
  const h1 = $('h1').first().text().trim() || null
  const artistName = pickArtistName(ogTitle, h1, title, url)

  const emails = new Set<string>()

  // 1. mailto: links.
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const match = MAILTO_REGEX.exec(href)
    if (match?.[1]) tryAddEmail(match[1], emails)
  })

  // 2. Emails en el texto.
  const bodyText = $('body').text()
  const matches = bodyText.match(EMAIL_REGEX) ?? []
  for (const raw of matches) tryAddEmail(raw, emails)

  // 3. Links absolutos del mismo dominio para el crawler.
  const links = new Set<string>()
  const base = new URL(url)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      const abs = new URL(href, base).toString()
      const absParsed = new URL(abs)
      if (absParsed.hostname === base.hostname) {
        links.add(stripFragment(abs))
      }
    } catch {
      // ignore
    }
  })

  return {
    url,
    title,
    artistName,
    emails: Array.from(emails),
    links: Array.from(links),
  }
}

function tryAddEmail(raw: string, out: Set<string>): void {
  const parsed = Email.safeParse(raw)
  if (!parsed.success) return
  const email = parsed.email.value
  if (BLOCKED_EMAILS.has(email)) return
  const local = email.split('@')[0]!
  if (BLOCKED_LOCALS.some((bad) => local === bad || local.startsWith(bad))) return
  out.add(email)
}

function pickArtistName(
  ogTitle: string | null,
  h1: string | null,
  title: string | null,
  url: string,
): string | null {
  const candidates = [ogTitle, h1, title].filter(Boolean) as string[]
  for (const c of candidates) {
    const cleaned = cleanTitle(c)
    if (cleaned.length >= 2 && cleaned.length <= 200) return cleaned
  }
  // Último recurso: último segmento de la URL formateado.
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (!last) return null
    return decodeURIComponent(last).replace(/[-_]+/g, ' ').trim() || null
  } catch {
    return null
  }
}

function cleanTitle(t: string): string {
  // Elimina sufijos comunes tipo " — Nombre del sitio" o " | Nombre".
  return t.split(/\s*[–—|]\s*/).shift()!.trim()
}

function stripFragment(url: string): string {
  const idx = url.indexOf('#')
  return idx >= 0 ? url.slice(0, idx) : url
}
