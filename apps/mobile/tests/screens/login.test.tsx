import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import LoginScreen from '../../app/(auth)/login'
import { AuthProvider } from '../../src/lib/auth-context'

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>,
  )
}

describe('LoginScreen (native)', () => {
  it('renders headline and disabled submit initially', async () => {
    renderLogin()
    await waitFor(() => {
      expect(screen.getByText('Artist Outreach')).toBeTruthy()
    })
    const submit = screen.getByTestId('login-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(true)
  })

  it('submit stays disabled with only email', async () => {
    renderLogin()
    await waitFor(() => screen.getByTestId('login-email'))
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('login-email'), 'me@example.com')
    })
    const submit = screen.getByTestId('login-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(true)
  })

  it('enables submit once email and password are entered', async () => {
    renderLogin()
    await waitFor(() => screen.getByTestId('login-email'))
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('login-email'), 'me@example.com')
      fireEvent.changeText(screen.getByTestId('login-password'), 'hunter2')
    })
    const submit = screen.getByTestId('login-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(false)
  })

  it('has a password field with type=password (masked)', async () => {
    renderLogin()
    await waitFor(() => screen.getByTestId('login-password'))
    expect(screen.getByTestId('login-password')).toBeTruthy()
  })
})
