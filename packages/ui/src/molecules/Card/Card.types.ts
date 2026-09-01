import type { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  variant?: 'default' | 'raised' | 'muted'
  onPress?: () => void
  testID?: string
}
