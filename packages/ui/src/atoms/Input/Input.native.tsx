import { TextInput } from 'react-native'
import type { InputProps } from './Input.types'

const keyboardType = {
  text: 'default',
  email: 'email-address',
  url: 'url',
  search: 'default',
} as const

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
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      testID={testID}
      keyboardType={keyboardType[type]}
      autoCapitalize={type === 'email' || type === 'url' ? 'none' : 'sentences'}
      className={`w-full px-3 py-3 rounded-md text-base bg-surface-base text-text-primary border ${
        invalid ? 'border-status-notEligible' : 'border-border-subtle'
      } ${disabled ? 'opacity-50' : ''}`}
    />
  )
}
