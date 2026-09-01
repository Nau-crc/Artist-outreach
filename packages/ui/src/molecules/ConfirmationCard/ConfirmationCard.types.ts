import type { ReactNode } from 'react'

export type ConfirmationVariant = 'success' | 'info' | 'warning' | 'error'

export interface ConfirmationCardProps {
  variant?: ConfirmationVariant
  title: string
  description?: string
  action?: ReactNode
  testID?: string
}
