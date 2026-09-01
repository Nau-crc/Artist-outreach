import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConfirmationCard } from './ConfirmationCard'

describe('ConfirmationCard (web)', () => {
  it('renders title and description', () => {
    render(<ConfirmationCard title="Ok" description="msg" />)
    expect(screen.getByText('Ok')).toBeInTheDocument()
    expect(screen.getByText('msg')).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<ConfirmationCard title="Err" variant="error" testID="c" />)
    expect(screen.getByTestId('c').className).toContain('status-notEligible')
  })
})
