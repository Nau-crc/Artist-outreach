import { render, screen } from '@testing-library/react'
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
    screen.getByRole('button').click()
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
    btn.click()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('applies variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button').className).toContain('status-notEligible')
  })
})
