import clsx from 'clsx'
import type { InputProps } from './Input.types'

export function Input({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
  autoFocus,
  invalid,
  testID,
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      data-testid={testID}
      aria-invalid={invalid || undefined}
      className={clsx(
        'w-full px-3 py-2 rounded-md text-base bg-surface-base text-text-primary',
        'border border-border-subtle focus:outline-none focus:ring-2 focus:ring-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid && 'border-status-notEligible focus:ring-status-notEligible',
      )}
    />
  )
}
