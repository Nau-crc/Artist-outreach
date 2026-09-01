import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContactCard } from './ContactCard'
import type { ContactCardData } from './ContactCard.types'

const contact: ContactCardData = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  artistName: 'Ana Luz',
  email: 'ana@example.com',
  discipline: 'música',
  country: 'ES',
  city: 'Barcelona',
  contactStatus: 'REVIEW_REQUIRED',
  emailStatus: 'FOUND',
  consentStatus: 'UNKNOWN',
  permission: 'NOT_REVIEWED',
}

describe('ContactCard (web)', () => {
  it('shows artist name, email and location', () => {
    render(<ContactCard contact={contact} testID="c" />)
    expect(screen.getByText('Ana Luz')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Barcelona/)).toBeInTheDocument()
  })

  it('renders all four status pills', () => {
    render(<ContactCard contact={contact} />)
    expect(screen.getByText('Revisar')).toBeInTheDocument()
    expect(screen.getByText('Con email')).toBeInTheDocument()
    expect(screen.getByText('Sin solicitar')).toBeInTheDocument()
    expect(screen.getByText('Sin revisar')).toBeInTheDocument()
  })

  it('calls onPress with contact id', () => {
    const onPress = vi.fn()
    render(<ContactCard contact={contact} onPress={onPress} testID="c" />)
    fireEvent.click(screen.getByTestId('c'))
    expect(onPress).toHaveBeenCalledWith(contact.id)
  })

  it('handles missing optional fields', () => {
    render(
      <ContactCard
        contact={{ ...contact, email: null, city: null, country: null, discipline: null }}
        testID="c"
      />,
    )
    expect(screen.getByText('Ana Luz')).toBeInTheDocument()
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
  })
})
