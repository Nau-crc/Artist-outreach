import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SubscribeForm } from './SubscribeForm'

describe('SubscribeForm (web)', () => {
  it('submit is disabled until email + acceptance', () => {
    render(<SubscribeForm onSubmit={vi.fn().mockResolvedValue('ok')} />)
    const submit = screen.getByTestId('subscribe-submit')
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByTestId('subscribe-email'), { target: { value: 'x@y.com' } })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByTestId('subscribe-accept'))
    expect(submit).not.toBeDisabled()
  })

  it('does not premark the acceptance checkbox', () => {
    render(<SubscribeForm onSubmit={vi.fn().mockResolvedValue('ok')} />)
    expect(screen.getByTestId('subscribe-accept')).not.toBeChecked()
  })

  it('calls onSubmit with normalized email', async () => {
    const onSubmit = vi.fn().mockResolvedValue('ok')
    render(<SubscribeForm onSubmit={onSubmit} />)
    fireEvent.change(screen.getByTestId('subscribe-email'), { target: { value: '  Ana@Example.COM ' } })
    fireEvent.click(screen.getByTestId('subscribe-accept'))
    fireEvent.click(screen.getByTestId('subscribe-submit'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ana@example.com'))
  })

  it('shows success card after ok', async () => {
    render(<SubscribeForm onSubmit={vi.fn().mockResolvedValue('ok')} />)
    fireEvent.change(screen.getByTestId('subscribe-email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByTestId('subscribe-accept'))
    fireEvent.click(screen.getByTestId('subscribe-submit'))
    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeInTheDocument())
  })

  it('shows inline error on failure', async () => {
    render(<SubscribeForm onSubmit={vi.fn().mockResolvedValue({ error: 'algo' })} />)
    fireEvent.change(screen.getByTestId('subscribe-email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByTestId('subscribe-accept'))
    fireEvent.click(screen.getByTestId('subscribe-submit'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('algo'))
  })
})
