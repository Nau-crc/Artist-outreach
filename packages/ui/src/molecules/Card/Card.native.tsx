import { Pressable, View } from 'react-native'
import type { CardProps } from './Card.types'

const variantClasses = {
  default: 'bg-surface-base border border-border-subtle',
  raised: 'bg-surface-base border border-border-subtle',
  muted: 'bg-surface-subtle',
} as const

export function Card({ children, variant = 'default', onPress, testID }: CardProps) {
  const className = `rounded-lg p-4 w-full ${variantClasses[variant]}`
  if (onPress) {
    return (
      <Pressable onPress={onPress} testID={testID} className={className}>
        {children}
      </Pressable>
    )
  }
  return (
    <View testID={testID} className={className}>
      {children}
    </View>
  )
}
