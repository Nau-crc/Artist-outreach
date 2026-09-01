import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'

describe('FormField (web)', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Nombre">
        <input data-testid="child" />
      </FormField>,
    )
    expect(screen.getByText('Nombre')).toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows hint when no error', () => {
    render(
      <FormField label="X" hint="Ayuda">
        <span />
      </FormField>,
    )
    expect(screen.getByText('Ayuda')).toBeInTheDocument()
  })

  it('error takes precedence over hint', () => {
    render(
      <FormField label="X" hint="ayuda" error="fallo">
        <span />
      </FormField>,
    )
    expect(screen.getByText('fallo')).toBeInTheDocument()
    expect(screen.queryByText('ayuda')).not.toBeInTheDocument()
  })

  it('marks required', () => {
    render(
      <FormField label="X" required>
        <span />
      </FormField>,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
