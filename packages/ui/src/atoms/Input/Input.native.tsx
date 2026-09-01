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
  multiline,
  rows = 6,
  testID,
}: InputProps) {
  const border = invalid ? 'border-status-notEligible' : 'border-border-subtle'
  const opacity = disabled ? 'opacity-50' : ''
  const shape = multiline ? 'min-h-[160px] text-sm font-mono' : 'text-base'

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
      multiline={multiline}
      numberOfLines={multiline ? rows : 1}
      textAlignVertical={multiline ? 'top' : 'auto'}
      className={`w-full px-3 py-3 rounded-md bg-surface-base text-text-primary border ${border} ${opacity} ${shape}`}
    />
  )
}
