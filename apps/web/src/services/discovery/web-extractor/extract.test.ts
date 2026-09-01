import { describe, expect, it } from 'vitest'
import { parsePage } from './extract'

describe('parsePage', () => {
  it('extracts emails from mailto and body text', () => {
    const html = `
      <html><body>
        <p>Contacto: <a href="mailto:ana@example.com">ana</a></p>
        <p>Copia a: manager@example.com</p>
      </body></html>
    `
    const page = parsePage(html, 'https://example.com/ana')
    expect(page.emails).toContain('ana@example.com')
    expect(page.emails).toContain('manager@example.com')
  })

  it('deduplicates emails', () => {
    const html = '<a href="mailto:x@y.com">x</a> <p>x@y.com</p>'
    const page = parsePage(html, 'https://x.com/')
    expect(page.emails.filter((e) => e === 'x@y.com')).toHaveLength(1)
  })

  it('normalizes emails to lowercase', () => {
    const html = '<p>Contact@Example.COM</p>'
    const page = parsePage(html, 'https://x.com/')
    expect(page.emails).toContain('contact@example.com')
  })

  it('skips role/system emails', () => {
    const html = '<p>noreply@x.com donotreply@y.com postmaster@z.com</p>'
    const page = parsePage(html, 'https://x.com/')
    expect(page.emails).toEqual([])
  })

  it('skips example addresses', () => {
    const html = '<p>example@example.com test@test.com</p>'
    const page = parsePage(html, 'https://x.com/')
    expect(page.emails).toEqual([])
  })

  it('picks artistName from og:title first, then h1, then title', () => {
    const withOg = parsePage(
      '<html><head><meta property="og:title" content="Ana Luz"/><title>Ana Luz — Portfolio</title></head><body><h1>Otra cosa</h1></body></html>',
      'https://example.com/ana',
    )
    expect(withOg.artistName).toBe('Ana Luz')

    const noOg = parsePage(
      '<html><head><title>Portfolio</title></head><body><h1>Diego Arriaga</h1></body></html>',
      'https://example.com/diego',
    )
    expect(noOg.artistName).toBe('Diego Arriaga')
  })

  it('cleans site suffix from title (— or |)', () => {
    const p = parsePage(
      '<html><head><title>Sofía Caldera | Sitio Oficial</title></head><body></body></html>',
      'https://example.com/',
    )
    expect(p.artistName).toBe('Sofía Caldera')
  })

  it('falls back to URL slug when no title', () => {
    const p = parsePage(
      '<html><head></head><body></body></html>',
      'https://example.com/artistas/martin-rio',
    )
    expect(p.artistName).toBe('martin rio')
  })

  it('extracts same-domain links absolute', () => {
    const html = `
      <a href="/artistas/ana">ana</a>
      <a href="https://example.com/artistas/bob">bob</a>
      <a href="https://other.com/x">other</a>
      <a href="/artistas/ana#bio">ana bio</a>
    `
    const p = parsePage(html, 'https://example.com/artistas')
    expect(p.links).toContain('https://example.com/artistas/ana')
    expect(p.links).toContain('https://example.com/artistas/bob')
    expect(p.links).not.toContain('https://other.com/x')
    // Fragmentos deduplicados con el sin-fragmento.
    expect(p.links.filter((l) => l.includes('/artistas/ana'))).toHaveLength(1)
  })
})
