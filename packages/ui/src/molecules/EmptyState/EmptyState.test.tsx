import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState (web)', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Sin datos" description="Aún no hay contactos" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay contactos')).toBeInTheDocument()
  })

  it('renders optional action', () => {
    render(<EmptyState title="X" action={<button>Añadir</button>} />)
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeInTheDocument()
  })
})
