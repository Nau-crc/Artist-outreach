export const EmailStatus = {
  NOT_FOUND: 'NOT_FOUND',
  FOUND: 'FOUND',
  INVALID: 'INVALID',
  BOUNCED: 'BOUNCED',
} as const

export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus]

export const EMAIL_STATUS_VALUES = Object.values(EmailStatus)
