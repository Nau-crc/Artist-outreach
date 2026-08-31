export const ConsentStatus = {
  UNKNOWN: 'UNKNOWN',
  REQUESTED: 'REQUESTED',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  WITHDRAWN: 'WITHDRAWN',
} as const

export type ConsentStatus = (typeof ConsentStatus)[keyof typeof ConsentStatus]

export const CONSENT_STATUS_VALUES = Object.values(ConsentStatus)
