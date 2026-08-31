import clsx from 'clsx'
import type { ButtonProps } from './Button.types'

const variantClasses = {
  primary: 'bg-brand-500 text-text-inverse hover:bg-brand-600 active:bg-brand-700',
  secondary: 'bg-surface-subtle text-text-primary hover:bg-surface-muted',
  ghost: 'bg-transparent text-text-primary hover:bg-surface-subtle',
  danger: 'bg-status-notEligible text-text-inverse hover:opacity-90',
} as const

const sizeClasses = {
  sm: 'text-sm px-3 py-2 rounded-md',
  md: 'text-base px-4 py-3 rounded-md',
  lg: 'text-lg px-6 py-4 rounded-lg',
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
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      data-testid={testID}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
      )}
    >
      {children}
    </button>
  )
}
