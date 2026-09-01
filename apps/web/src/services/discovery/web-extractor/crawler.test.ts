import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crawlSite } from './crawler'
import { clearRobotsCacheForTests } from './robots'

function mockPages(map: Record<string, { status?: number; contentType?: string; body?: string }>): typeof fetch {
  return vi.fn(async (url: string) => {
    const key = String(url)
    const page = map[key]
    if (!page) return new Response('', { status: 404 })
    return new Response(page.body ?? '', {
      status: page.status ?? 200,
      headers: { 'content-type': page.contentType ?? 'text/html' },
    })
  }) as unknown as typeof fetch
}

describe('crawlSite', () => {
  beforeEach(() => clearRobotsCacheForTests())

  it('BFS até maxDepth y maxPages, mismo host', async () => {
    const html = (title: string, links: string[], emails: string[]) => `
      <html><head><title>${title}</title></head><body>
        ${emails.map((e) => `<p>${e}</p>`).join('')}
        ${links.map((l) => `<a href="${l}">l</a>`).join('')}
      </body></html>
    `
    const pages = {
      'https://ok.test/robots.txt': { status: 404 },
      'https://ok.test/': { body: html('Home', ['/a', '/b', 'https://other.com/x'], []) },
      'https://ok.test/a': { body: html('Ana', ['/a/1'], ['ana@ok.test']) },
      'https://ok.test/a/1': { body: html('Ana 1', [], ['ana1@ok.test']) },
      'https://ok.test/b': { body: html('Bob', [], ['bob@ok.test']) },
    }
    const report = await crawlSite(
      { startUrl: 'https://ok.test/', maxPages: 10, maxDepth: 1, rateLimitMs: 0 },
      mockPages(pages),
    )
    expect(report.visitedCount).toBeGreaterThan(0)
    const urls = report.pages.map((p) => p.url)
    expect(urls).toContain('https://ok.test/')
    expect(urls).toContain('https://ok.test/a')
    expect(urls).toContain('https://ok.test/b')
    // maxDepth=1 no llega a /a/1.
    expect(urls).not.toContain('https://ok.test/a/1')
    // No visita cross-origin.
    expect(urls).not.toContain('https://other.com/x')
    expect(report.emailsCount).toBe(2)
    expect(report.results.map((r) => r.email)).toContain('ana@ok.test')
    expect(report.results.map((r) => r.email)).toContain('bob@ok.test')
  })

  it('respeta robots.txt disallow', async () => {
    const pages = {
      'https://ok.test/robots.txt': {
        body: 'User-agent: *\nDisallow: /private\n',
      },
      'https://ok.test/': { body: '<a href="/private">p</a><a href="/pub">p</a>' },
      'https://ok.test/pub': { body: '<p>ok@ok.test</p>' },
      'https://ok.test/private': { body: '<p>secret@ok.test</p>' },
    }
    const report = await crawlSite(
      { startUrl: 'https://ok.test/', maxPages: 10, maxDepth: 1, rateLimitMs: 0 },
      mockPages(pages),
    )
    const skipped = report.pages.find((p) => p.url === 'https://ok.test/private')
    expect(skipped?.status).toBe('skipped_robots')
    // No debió extraer emails de /private.
    const emails = report.results.map((r) => r.email)
    expect(emails).toContain('ok@ok.test')
    expect(emails).not.toContain('secret@ok.test')
  })

  it('respeta maxPages incluso si hay más links', async () => {
    const pages: Record<string, { body?: string }> = {
      'https://ok.test/robots.txt': { body: '' },
      'https://ok.test/': {
        body: Array.from({ length: 10 }, (_, i) => `<a href="/${i}">l</a>`).join(''),
      },
    }
    for (let i = 0; i < 10; i++) {
      pages[`https://ok.test/${i}`] = { body: `<p>u${i}@ok.test</p>` }
    }
    const report = await crawlSite(
      { startUrl: 'https://ok.test/', maxPages: 4, maxDepth: 1, rateLimitMs: 0 },
      mockPages(pages),
    )
    expect(report.visitedCount).toBe(4)
  })

  it('salta contenido no HTML', async () => {
    const pages = {
      'https://ok.test/robots.txt': { status: 404 },
      'https://ok.test/': {
        body: '<a href="/img.png">img</a><a href="/page">p</a>',
      },
      'https://ok.test/img.png': { contentType: 'image/png', body: '' },
      'https://ok.test/page': { body: '<p>o@k.test</p>' },
    }
    const report = await crawlSite(
      { startUrl: 'https://ok.test/', maxPages: 10, maxDepth: 1, rateLimitMs: 0 },
      mockPages(pages),
    )
    const imgOutcome = report.pages.find((p) => p.url === 'https://ok.test/img.png')
    expect(imgOutcome?.error).toContain('non-html')
  })
})
