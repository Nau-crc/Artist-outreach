import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar (web)', () => {
  it('renders default placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} testID="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('placeholder', 'Buscar…')
  })

  it('emits changes', () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} testID="s" />)
    fireEvent.change(screen.getByTestId('s'), { target: { value: 'ana' } })
    expect(onChange).toHaveBeenCalledWith('ana')
  })
})
