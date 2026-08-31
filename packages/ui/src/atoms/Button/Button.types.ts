import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  onPress?: () => void
  testID?: string
}
