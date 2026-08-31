// Fase 1: solo verifica que el toolchain de Jest arranca en apps/mobile.
// Los tests reales de componentes RN llegan en fase 2 con jest-expo montado a fondo.
describe('mobile toolchain', () => {
  it('runs jest', () => {
    expect(1 + 1).toBe(2)
  })

  it('resolves TypeScript', () => {
    const value: string = 'ok'
    expect(value).toBe('ok')
  })
})
