import { checkHealth } from '../src/lib/api'

describe('mobile toolchain', () => {
  it('runs jest', () => {
    expect(1 + 1).toBe(2)
  })

  it('exports checkHealth', () => {
    expect(typeof checkHealth).toBe('function')
  })
})
