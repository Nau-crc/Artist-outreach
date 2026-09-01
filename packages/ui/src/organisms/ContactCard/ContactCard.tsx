import { Card } from '../../molecules/Card'
import { StatusPill } from '../../molecules/StatusPill'
import type { ContactCardProps } from './ContactCard.types'

export function ContactCard({ contact, onPress, testID }: ContactCardProps) {
  const location = [contact.city, contact.country].filter(Boolean).join(' · ')

  return (
    <Card
      variant="default"
      onPress={onPress ? () => onPress(contact.id) : undefined}
      testID={testID}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-text-primary">{contact.artistName}</span>
          {contact.discipline || location ? (
            <span className="text-sm text-text-secondary">
              {[contact.discipline, location].filter(Boolean).join(' — ')}
            </span>
          ) : null}
          {contact.email && (
            <span className="text-xs text-text-muted font-mono">{contact.email}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill kind="contact" value={contact.contactStatus} />
          <StatusPill kind="email" value={contact.emailStatus} />
          <StatusPill kind="consent" value={contact.consentStatus} />
          <StatusPill kind="permission" value={contact.permission} />
        </div>
      </div>
    </Card>
  )
}
