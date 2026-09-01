import { render, screen } from '@testing-library/react-native'
import { StatusPill } from '@artist-outreach/ui/molecules'

describe('StatusPill (native)', () => {
  it('maps contact REVIEWED to "Revisado"', () => {
    render(<StatusPill kind="contact" value="REVIEWED" />)
    expect(screen.getByText('Revisado')).toBeTruthy()
  })

  it('maps email BOUNCED to "Email rebota"', () => {
    render(<StatusPill kind="email" value="BOUNCED" />)
    expect(screen.getByText('Email rebota')).toBeTruthy()
  })

  it('maps permission ELIGIBLE to "Elegible"', () => {
    render(<StatusPill kind="permission" value="ELIGIBLE" />)
    expect(screen.getByText('Elegible')).toBeTruthy()
  })

  it('maps consent CONFIRMED to "Confirmado"', () => {
    render(<StatusPill kind="consent" value="CONFIRMED" />)
    expect(screen.getByText('Confirmado')).toBeTruthy()
  })
})
