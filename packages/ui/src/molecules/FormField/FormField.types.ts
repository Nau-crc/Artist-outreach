import type { ReactNode } from 'react'

export interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  testID?: string
}
