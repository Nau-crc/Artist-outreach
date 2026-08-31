import { Pressable, Text } from 'react-native'
import type { ButtonProps } from './Button.types'

const variantClasses = {
  primary: 'bg-brand-500 active:bg-brand-700',
  secondary: 'bg-surface-subtle active:bg-surface-muted',
  ghost: 'bg-transparent active:bg-surface-subtle',
  danger: 'bg-status-notEligible',
} as const

const variantTextClasses = {
  primary: 'text-text-inverse',
  secondary: 'text-text-primary',
  ghost: 'text-text-primary',
  danger: 'text-text-inverse',
} as const

const sizeClasses = {
  sm: 'px-3 py-2 rounded-md',
  md: 'px-4 py-3 rounded-md',
  lg: 'px-6 py-4 rounded-lg',
} as const

const sizeTextClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
} as const

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  onPress,
  testID,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50' : ''} items-center justify-center`}
    >
      <Text className={`${variantTextClasses[variant]} ${sizeTextClasses[size]} font-medium`}>
        {children}
      </Text>
    </Pressable>
  )
}
