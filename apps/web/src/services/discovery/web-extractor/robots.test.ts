import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRobots, clearRobotsCacheForTests } from './robots'

function mockFetch(response: { status: number; text?: string }): typeof fetch {
  return vi.fn(async () => {
    return new Response(response.text ?? '', {
      status: response.status,
    })
  }) as unknown as typeof fetch
}

describe('checkRobots', () => {
  beforeEach(() => clearRobotsCacheForTests())

  it('allows when robots.txt is missing (404)', async () => {
    const r = await checkRobots('https://example.com/x', mockFetch({ status: 404 }))
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('robots_missing')
  })

  it('respects Disallow for our user-agent', async () => {
    const robots = 'User-agent: *\nDisallow: /admin\n'
    const r = await checkRobots('https://example.com/admin/x', mockFetch({ status: 200, text: robots }))
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('robots_disallowed')
  })

  it('allows paths not disallowed', async () => {
    const robots = 'User-agent: *\nDisallow: /admin\n'
    const r = await checkRobots('https://example.com/artists/ana', mockFetch({ status: 200, text: robots }))
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('robots_allowed')
  })

  it('applies crawl-delay in ms', async () => {
    const robots = 'User-agent: *\nCrawl-delay: 5\n'
    const r = await checkRobots('https://example.com/', mockFetch({ status: 200, text: robots }))
    expect(r.crawlDelayMs).toBe(5000)
  })

  it('rejects invalid URLs', async () => {
    const r = await checkRobots('not-a-url', mockFetch({ status: 200 }))
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('robots_error')
  })

  it('treats fetch errors as missing', async () => {
    const errorFetch = vi.fn(() => Promise.reject(new Error('boom'))) as unknown as typeof fetch
    const r = await checkRobots('https://example.com/x', errorFetch)
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('robots_missing')
  })
})
