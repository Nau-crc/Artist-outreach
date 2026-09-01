import type { ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  testID?: string
}
