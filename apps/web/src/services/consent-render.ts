import type { Contact } from '@prisma/client'
import type { TemplateSnapshot } from '@/models/consent-requests.model'

const APP_URL_DEFAULT = 'http://localhost:3000'

export interface RenderedConsentEmail {
  subject: string
  html: string
  text: string
}

/**
 * Renderiza el email de solicitud de consentimiento sustituyendo las
 * variables {{ artistName }}, {{ confirmUrl }}, {{ unsubscribeUrl }}
 * con valores reales del contacto y del token de la request. Trabaja
 * sobre el snapshot congelado — no lee el template actual.
 */
export function renderConsentEmail(
  snapshot: TemplateSnapshot,
  contact: Contact,
  token: string,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? APP_URL_DEFAULT,
): RenderedConsentEmail {
  const base = appUrl.replace(/\/+$/, '')
  const confirmUrl = `${base}/consent/${encodeURIComponent(token)}`
  const declineUrl = `${base}/consent/${encodeURIComponent(token)}?action=decline`

  const artistName = contact.artistName?.trim() || 'artista'

  const vars: Record<string, string> = {
    artistName,
    confirmUrl,
    unsubscribeUrl: declineUrl,
  }

  return {
    subject: applyVars(snapshot.subject, vars),
    html: applyVars(snapshot.html, vars),
    text: applyVars(snapshot.text, vars),
  }
}

function applyVars(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*(artistName|confirmUrl|unsubscribeUrl)\s*\}\}/g, (_, key) => {
    return vars[key] ?? ''
  })
}
