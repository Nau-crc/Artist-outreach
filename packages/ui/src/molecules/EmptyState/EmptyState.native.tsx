import { Text, View } from 'react-native'
import type { EmptyStateProps } from './EmptyState.types'

export function EmptyState({ title, description, action, testID }: EmptyStateProps) {
  return (
    <View
      testID={testID}
      className="items-center justify-center py-12 px-6 gap-2"
    >
      <Text className="text-lg font-semibold text-text-primary text-center">{title}</Text>
      {description && <Text className="text-sm text-text-secondary text-center">{description}</Text>}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  )
}
