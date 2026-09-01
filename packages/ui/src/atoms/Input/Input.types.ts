export interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  type?: 'text' | 'email' | 'url' | 'search'
  autoFocus?: boolean
  invalid?: boolean
  multiline?: boolean
  rows?: number
  testID?: string
}
