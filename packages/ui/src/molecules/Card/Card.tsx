import clsx from 'clsx'
import type { CardProps } from './Card.types'

const variantClasses = {
  default: 'bg-surface-base border border-border-subtle',
  raised: 'bg-surface-base shadow-sm border border-border-subtle',
  muted: 'bg-surface-subtle border border-transparent',
} as const

export function Card({ children, variant = 'default', onPress, testID }: CardProps) {
  const Component = onPress ? 'button' : 'div'
  return (
    <Component
      type={onPress ? 'button' : undefined}
      onClick={onPress}
      data-testid={testID}
      className={clsx(
        'rounded-lg p-4 w-full text-left',
        variantClasses[variant],
        onPress && 'hover:bg-surface-subtle transition-colors',
      )}
    >
      {children}
    </Component>
  )
}
