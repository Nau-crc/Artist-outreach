import { htmlToPlainText } from '../../src/lib/html-to-text'

describe('htmlToPlainText', () => {
  it('extracts paragraphs separated by double newline', () => {
    const html = '<p>Hola</p><p>Qué tal</p>'
    expect(htmlToPlainText(html)).toBe('Hola\n\nQué tal')
  })

  it('preserves single line breaks with <br>', () => {
    const html = '<p>Línea 1<br>Línea 2</p>'
    expect(htmlToPlainText(html)).toBe('Línea 1\nLínea 2')
  })

  it('preserves template variables from data-variable', () => {
    const html = '<p>Hola <span class="tpl-var" data-variable="{{ artistName }}">{{ artistName }}</span></p>'
    expect(htmlToPlainText(html)).toContain('{{ artistName }}')
  })

  it('renders lists as dash bullets', () => {
    const html = '<ul><li>Uno</li><li>Dos</li></ul>'
    expect(htmlToPlainText(html)).toContain('- Uno')
    expect(htmlToPlainText(html)).toContain('- Dos')
  })

  it('renders CTA links as "Label: variable"', () => {
    const html =
      '<p><a class="tpl-cta" data-variable="{{ confirmUrl }}" data-label="Confirmar suscripción" href="{{ confirmUrl }}">Confirmar suscripción</a></p>'
    expect(htmlToPlainText(html)).toContain('Confirmar suscripción: {{ confirmUrl }}')
  })

  it('renders unsubscribe link as "Label: variable"', () => {
    const html =
      '<p><a class="tpl-unsub" data-label="Darse de baja" data-variable="{{ unsubscribeUrl }}" href="{{ unsubscribeUrl }}">Darse de baja</a></p>'
    expect(htmlToPlainText(html)).toContain('Darse de baja: {{ unsubscribeUrl }}')
  })
})
