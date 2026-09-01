import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'

describe('Badge (web)', () => {
  it('renders children', () => {
    render(<Badge>ELIGIBLE</Badge>)
    expect(screen.getByText('ELIGIBLE')).toBeInTheDocument()
  })

  it('applies tone class', () => {
    render(<Badge tone="success">OK</Badge>)
    expect(screen.getByText('OK')).toHaveClass('text-status-eligible')
  })

  it('defaults to neutral tone', () => {
    render(<Badge>x</Badge>)
    expect(screen.getByText('x')).toHaveClass('bg-surface-muted')
  })
})
