import { Text, View } from 'react-native'
import type { BadgeProps, BadgeTone } from './Badge.types'

const containerTone: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted',
  brand: 'bg-brand-100',
  success: 'bg-status-eligible/15',
  warning: 'bg-status-reviewRequired/15',
  danger: 'bg-status-notEligible/15',
  muted: 'bg-surface-subtle',
}

const textTone: Record<BadgeTone, string> = {
  neutral: 'text-text-secondary',
  brand: 'text-brand-700',
  success: 'text-status-eligible',
  warning: 'text-status-reviewRequired',
  danger: 'text-status-notEligible',
  muted: 'text-text-muted',
}

export function Badge({ children, tone = 'neutral', testID }: BadgeProps) {
  return (
    <View
      testID={testID}
      className={`self-start px-2 py-1 rounded-sm ${containerTone[tone]}`}
    >
      <Text className={`text-xs font-medium ${textTone[tone]}`}>{children}</Text>
    </View>
  )
}
