import { Text, View } from 'react-native'
import type { AppHeaderProps } from './AppHeader.types'

export function AppHeader({ title, subtitle, trailing, testID }: AppHeaderProps) {
  return (
    <View
      testID={testID}
      className="flex-row items-center justify-between px-6 py-4 border-b border-border-subtle"
    >
      <View>
        <Text className="text-xl font-semibold text-text-primary">{title}</Text>
        {subtitle ? <Text className="text-sm text-text-secondary">{subtitle}</Text> : null}
      </View>
      {trailing ? <View className="flex-row items-center gap-2">{trailing}</View> : null}
    </View>
  )
}
