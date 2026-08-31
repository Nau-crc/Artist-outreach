import { checkHealth } from '../src/lib/api'

describe('api client', () => {
  it('exports checkHealth', () => {
    expect(typeof checkHealth).toBe('function')
  })
})
