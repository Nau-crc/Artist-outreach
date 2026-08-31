export const ContactStatus = {
  DISCOVERED: 'DISCOVERED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  REVIEWED: 'REVIEWED',
  DISCARDED: 'DISCARDED',
  SUPPRESSED: 'SUPPRESSED',
} as const

export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus]

export const CONTACT_STATUS_VALUES = Object.values(ContactStatus)
