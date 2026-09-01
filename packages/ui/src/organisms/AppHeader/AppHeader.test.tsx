import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppHeader } from './AppHeader'

describe('AppHeader (web)', () => {
  it('renders title', () => {
    render(<AppHeader title="Contactos" />)
    expect(screen.getByRole('heading', { name: 'Contactos' })).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<AppHeader title="X" subtitle="20 elementos" />)
    expect(screen.getByText('20 elementos')).toBeInTheDocument()
  })

  it('renders trailing content', () => {
    render(<AppHeader title="X" trailing={<button>Añadir</button>} />)
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeInTheDocument()
  })
})
