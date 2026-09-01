import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input'

describe('Input (web)', () => {
  it('renders value', () => {
    render(<Input value="hola" onChange={() => {}} testID="in" />)
    expect(screen.getByTestId('in')).toHaveValue('hola')
  })

  it('emits changes', () => {
    const onChange = vi.fn()
    render(<Input value="" onChange={onChange} testID="in" />)
    fireEvent.change(screen.getByTestId('in'), { target: { value: 'a' } })
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('marks invalid state', () => {
    render(<Input value="" onChange={() => {}} invalid testID="in" />)
    expect(screen.getByTestId('in')).toHaveAttribute('aria-invalid', 'true')
  })

  it('respects disabled', () => {
    render(<Input value="" onChange={() => {}} disabled testID="in" />)
    expect(screen.getByTestId('in')).toBeDisabled()
  })

  it('renders a textarea when multiline is true', () => {
    render(<Input value="a\nb\nc" onChange={() => {}} multiline rows={8} testID="in" />)
    const el = screen.getByTestId('in')
    expect(el.tagName).toBe('TEXTAREA')
    expect(el).toHaveAttribute('rows', '8')
  })
})
