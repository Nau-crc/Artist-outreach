import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from './Card'

describe('Card (web)', () => {
  it('renders as div when no onPress', () => {
    render(<Card testID="c">content</Card>)
    expect(screen.getByTestId('c').tagName).toBe('DIV')
  })

  it('renders as button when onPress provided and calls it', () => {
    const onPress = vi.fn()
    render(
      <Card testID="c" onPress={onPress}>
        clickable
      </Card>,
    )
    const el = screen.getByTestId('c')
    expect(el.tagName).toBe('BUTTON')
    fireEvent.click(el)
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('applies variant class', () => {
    render(
      <Card variant="muted" testID="c">
        m
      </Card>,
    )
    expect(screen.getByTestId('c')).toHaveClass('bg-surface-subtle')
  })
})
