import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusPill } from './StatusPill'
import { statusToneAndLabel } from './statusMap'

describe('StatusPill (web)', () => {
  it('renders label for contact ELIGIBLE-ish (REVIEWED)', () => {
    render(<StatusPill kind="contact" value="REVIEWED" />)
    expect(screen.getByText('Revisado')).toBeInTheDocument()
  })

  it('renders success tone for FOUND email', () => {
    render(<StatusPill kind="email" value="FOUND" testID="p" />)
    expect(screen.getByTestId('p')).toHaveClass('text-status-eligible')
  })

  it('renders danger tone for BLOCKED permission', () => {
    render(<StatusPill kind="permission" value="BLOCKED" testID="p" />)
    expect(screen.getByTestId('p')).toHaveClass('text-status-notEligible')
  })

  it('statusToneAndLabel falls back on unknown value', () => {
    // biome-ignore lint/suspicious/noExplicitAny: casting for coverage
    const { tone, label } = statusToneAndLabel('contact', 'WEIRD' as any)
    expect(tone).toBe('neutral')
    expect(label).toBe('WEIRD')
  })
})
