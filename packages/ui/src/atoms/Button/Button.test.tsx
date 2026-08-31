import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button (web)', () => {
  it('renders children', () => {
    render(<Button>Hello</Button>)
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
  })

  it('calls onPress when clicked', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('respects disabled', () => {
    const onPress = vi.fn()
    render(
      <Button onPress={onPress} disabled>
        Click
      </Button>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('applies variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-status-notEligible')
  })
})
