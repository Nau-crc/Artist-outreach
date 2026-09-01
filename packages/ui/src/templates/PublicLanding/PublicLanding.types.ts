import type { ReactNode } from 'react'

export interface PublicLandingProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  testID?: string
}
