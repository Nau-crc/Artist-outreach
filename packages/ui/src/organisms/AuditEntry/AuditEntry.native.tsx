import { Text, View } from 'react-native'
import { Badge } from '../../atoms/Badge'
import type { AuditEntryProps } from './AuditEntry.types'

const actorTone = {
  USER: 'brand',
  SYSTEM: 'muted',
  WEBHOOK: 'neutral',
  PUBLIC: 'warning',
} as const

export function AuditEntry({ entry, testID }: AuditEntryProps) {
  const when = new Date(entry.at).toLocaleString()
  return (
    <View testID={testID} className="py-3 border-b border-border-subtle gap-1">
      <View className="flex-row items-center gap-2 flex-wrap">
        <Badge tone={actorTone[entry.actorKind]}>{entry.actorKind}</Badge>
        <Text className="text-sm font-medium text-text-primary">{entry.action}</Text>
        <Text className="text-xs text-text-muted">
          {entry.entityType}
          {entry.entityId ? `#${entry.entityId.slice(0, 8)}` : ''}
        </Text>
      </View>
      <Text className="text-xs text-text-muted">{when}</Text>
    </View>
  )
}
