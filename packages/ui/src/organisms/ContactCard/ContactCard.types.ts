import type {
  ContactStatus,
  ConsentStatus,
  EmailStatus,
  Permission,
} from '@artist-outreach/shared'

export interface ContactCardData {
  id: string
  artistName: string
  email: string | null
  discipline: string | null
  country: string | null
  city: string | null
  contactStatus: ContactStatus
  emailStatus: EmailStatus
  consentStatus: ConsentStatus
  permission: Permission
}

export interface ContactCardProps {
  contact: ContactCardData
  onPress?: (id: string) => void
  testID?: string
}
