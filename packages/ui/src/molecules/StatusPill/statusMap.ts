import type { BadgeTone } from '../../atoms/Badge/Badge.types'
import type { StatusKind, StatusValue } from './StatusPill.types'

const CONTACT: Record<string, { tone: BadgeTone; label: string }> = {
  DISCOVERED: { tone: 'neutral', label: 'Descubierto' },
  REVIEW_REQUIRED: { tone: 'warning', label: 'Revisar' },
  REVIEWED: { tone: 'brand', label: 'Revisado' },
  DISCARDED: { tone: 'muted', label: 'Descartado' },
  SUPPRESSED: { tone: 'danger', label: 'Suprimido' },
}

const EMAIL: Record<string, { tone: BadgeTone; label: string }> = {
  NOT_FOUND: { tone: 'muted', label: 'Sin email' },
  FOUND: { tone: 'success', label: 'Con email' },
  INVALID: { tone: 'danger', label: 'Email inválido' },
  BOUNCED: { tone: 'danger', label: 'Email rebota' },
}

const CONSENT: Record<string, { tone: BadgeTone; label: string }> = {
  UNKNOWN: { tone: 'muted', label: 'Sin solicitar' },
  REQUESTED: { tone: 'warning', label: 'Solicitado' },
  PENDING: { tone: 'warning', label: 'Pendiente' },
  CONFIRMED: { tone: 'success', label: 'Confirmado' },
  WITHDRAWN: { tone: 'danger', label: 'Retirado' },
}

const PERMISSION: Record<string, { tone: BadgeTone; label: string }> = {
  NOT_REVIEWED: { tone: 'muted', label: 'Sin revisar' },
  ELIGIBLE: { tone: 'success', label: 'Elegible' },
  NOT_ELIGIBLE: { tone: 'danger', label: 'No elegible' },
  BLOCKED: { tone: 'danger', label: 'Bloqueado' },
}

const MAPS: Record<StatusKind, Record<string, { tone: BadgeTone; label: string }>> = {
  contact: CONTACT,
  email: EMAIL,
  consent: CONSENT,
  permission: PERMISSION,
}

export function statusToneAndLabel(kind: StatusKind, value: StatusValue): { tone: BadgeTone; label: string } {
  return MAPS[kind]?.[value as string] ?? { tone: 'neutral', label: String(value) }
}
