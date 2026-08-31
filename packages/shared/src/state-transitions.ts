import { ContactStatus } from './enums/contact-status'
import { ConsentStatus } from './enums/consent-status'
import { Permission } from './enums/permission'

type Transitions<T extends string> = Readonly<Record<T, readonly T[]>>

export const CONTACT_STATUS_TRANSITIONS: Transitions<ContactStatus> = {
  DISCOVERED: ['REVIEW_REQUIRED', 'DISCARDED', 'SUPPRESSED'],
  REVIEW_REQUIRED: ['REVIEWED', 'DISCARDED', 'SUPPRESSED'],
  REVIEWED: ['DISCARDED', 'SUPPRESSED'],
  DISCARDED: ['SUPPRESSED'],
  SUPPRESSED: [],
}

export const CONSENT_STATUS_TRANSITIONS: Transitions<ConsentStatus> = {
  UNKNOWN: ['REQUESTED'],
  REQUESTED: ['PENDING', 'CONFIRMED', 'WITHDRAWN'],
  PENDING: ['CONFIRMED', 'WITHDRAWN'],
  CONFIRMED: ['WITHDRAWN'],
  WITHDRAWN: [],
}

export const PERMISSION_TRANSITIONS: Transitions<Permission> = {
  NOT_REVIEWED: ['ELIGIBLE', 'NOT_ELIGIBLE', 'BLOCKED'],
  ELIGIBLE: ['NOT_ELIGIBLE', 'BLOCKED'],
  NOT_ELIGIBLE: ['ELIGIBLE', 'BLOCKED'],
  BLOCKED: [],
}

export function canTransition<T extends string>(
  transitions: Transitions<T>,
  from: T,
  to: T,
): boolean {
  return transitions[from]?.includes(to) ?? false
}
