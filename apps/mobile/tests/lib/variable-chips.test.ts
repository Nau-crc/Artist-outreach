import { appendVariable } from '../../src/components/VariableChips'

describe('appendVariable', () => {
  it('inserts the variable alone if current is empty', () => {
    expect(appendVariable('', '{{ x }}')).toBe('{{ x }}')
  })

  it('appends with a leading space if the current does not end in whitespace', () => {
    expect(appendVariable('Hola', '{{ x }}')).toBe('Hola {{ x }}')
  })

  it('does not add extra space if current ends in space', () => {
    expect(appendVariable('Hola ', '{{ x }}')).toBe('Hola {{ x }}')
  })

  it('does not add extra space if current ends in newline', () => {
    expect(appendVariable('Hola\n', '{{ x }}')).toBe('Hola\n{{ x }}')
  })
})
