import type {
  ContactStatus,
  ConsentStatus,
  EmailStatus,
  Permission,
} from '@artist-outreach/shared'

export type StatusKind = 'contact' | 'email' | 'consent' | 'permission'

export type StatusValue = ContactStatus | EmailStatus | ConsentStatus | Permission

export interface StatusPillProps {
  kind: StatusKind
  value: StatusValue
  testID?: string
}
