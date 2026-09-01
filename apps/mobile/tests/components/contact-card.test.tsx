import { fireEvent, render, screen } from '@testing-library/react-native'
import { ContactCard, type ContactCardData } from '@artist-outreach/ui/organisms'

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

describe('ContactCard (native)', () => {
  it('renders artist name, email and location', () => {
    render(<ContactCard contact={contact} testID="c" />)
    expect(screen.getByText('Ana Luz')).toBeTruthy()
    expect(screen.getByText('ana@example.com')).toBeTruthy()
    expect(screen.getByText(/Barcelona/)).toBeTruthy()
  })

  it('renders four status pills with labels', () => {
    render(<ContactCard contact={contact} />)
    expect(screen.getByText('Revisar')).toBeTruthy()
    expect(screen.getByText('Con email')).toBeTruthy()
    expect(screen.getByText('Sin solicitar')).toBeTruthy()
    expect(screen.getByText('Sin revisar')).toBeTruthy()
  })

  it('calls onPress with contact id', () => {
    const onPress = jest.fn()
    render(<ContactCard contact={contact} onPress={onPress} testID="card" />)
    fireEvent.press(screen.getByTestId('card'))
    expect(onPress).toHaveBeenCalledWith(contact.id)
  })
})
