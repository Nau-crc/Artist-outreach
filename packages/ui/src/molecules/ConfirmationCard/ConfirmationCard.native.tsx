import { Text, View } from 'react-native'
import type { ConfirmationCardProps, ConfirmationVariant } from './ConfirmationCard.types'

const variantClasses: Record<ConfirmationVariant, string> = {
  success: 'bg-status-eligible/10 border-status-eligible/30',
  info: 'bg-brand-50 border-brand-100',
  warning: 'bg-status-reviewRequired/10 border-status-reviewRequired/30',
  error: 'bg-status-notEligible/10 border-status-notEligible/30',
}

const titleColor: Record<ConfirmationVariant, string> = {
  success: 'text-status-eligible',
  info: 'text-brand-700',
  warning: 'text-status-reviewRequired',
  error: 'text-status-notEligible',
}

export function ConfirmationCard({
  variant = 'success',
  title,
  description,
  action,
  testID,
}: ConfirmationCardProps) {
  return (
    <View testID={testID} className={`p-6 rounded-lg border gap-3 ${variantClasses[variant]}`}>
      <Text className={`text-lg font-semibold ${titleColor[variant]}`}>{title}</Text>
      {description ? <Text className="text-sm text-text-secondary">{description}</Text> : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  )
}
