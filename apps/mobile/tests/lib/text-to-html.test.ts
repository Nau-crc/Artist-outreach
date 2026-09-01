import { fillPreviewVars, textToHtml } from '../../src/lib/text-to-html'

describe('textToHtml', () => {
  it('wraps paragraphs and preserves single line breaks', () => {
    const html = textToHtml('Hola\nqué tal\n\nOtro parrafo')
    expect(html).toContain('<p')
    expect(html.match(/<p/g)?.length).toBe(2)
    expect(html).toContain('<br>')
  })

  it('linkifies http URLs', () => {
    const html = textToHtml('Ver https://example.com aquí')
    expect(html).toContain('href="https://example.com"')
  })

  it('linkifies template variables for URLs', () => {
    const html = textToHtml('Confirmar: {{ confirmUrl }}')
    expect(html).toContain('href="{{ confirmUrl }}"')
  })

  it('escapes user HTML', () => {
    const html = textToHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('fillPreviewVars', () => {
  it('replaces artistName / confirmUrl / unsubscribeUrl with sample values', () => {
    const out = fillPreviewVars('{{ artistName }} — {{ confirmUrl }} / {{ unsubscribeUrl }}')
    expect(out).toBe('Ana Luz — https://ejemplo.com/confirmar/TOKEN / https://ejemplo.com/baja/TOKEN')
  })

  it('leaves unknown variables untouched', () => {
    expect(fillPreviewVars('{{ unknown }}')).toBe('{{ unknown }}')
  })
})
