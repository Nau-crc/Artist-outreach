import { Text, View } from 'react-native'
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
      <View className="gap-3">
        <View className="gap-1">
          <Text className="text-base font-semibold text-text-primary">{contact.artistName}</Text>
          {contact.discipline || location ? (
            <Text className="text-sm text-text-secondary">
              {[contact.discipline, location].filter(Boolean).join(' — ')}
            </Text>
          ) : null}
          {contact.email ? (
            <Text className="text-xs text-text-muted font-mono">{contact.email}</Text>
          ) : null}
        </View>
        <View className="flex-row flex-wrap gap-2">
          <StatusPill kind="contact" value={contact.contactStatus} />
          <StatusPill kind="email" value={contact.emailStatus} />
          <StatusPill kind="consent" value={contact.consentStatus} />
          <StatusPill kind="permission" value={contact.permission} />
        </View>
      </View>
    </Card>
  )
}
