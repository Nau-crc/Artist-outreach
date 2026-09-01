import type { ReactNode } from 'react'

export interface AppHeaderProps {
  title: string
  subtitle?: string
  trailing?: ReactNode
  testID?: string
}
