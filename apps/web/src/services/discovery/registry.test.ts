import { describe, expect, it, vi } from 'vitest'
import { ProviderNotVerifiedError, getVerifiedProvider, listProviders } from './registry'

describe('discovery registry', () => {
  it('lists at least csv-import and musicbrainz', () => {
    const slugs = listProviders().map((p) => p.slug)
    expect(slugs).toContain('csv-import')
    expect(slugs).toContain('musicbrainz')
  })

  it('csv-import is VERIFIED and executable', async () => {
    const provider = await getVerifiedProvider('csv-import')
    expect(provider.slug).toBe('csv-import')
  })

  it('throws for unknown provider', async () => {
    await expect(getVerifiedProvider('nope-does-not-exist')).rejects.toThrow(/Unknown/)
  })

  it('throws ProviderNotVerifiedError for UNVERIFIED providers', async () => {
    const csv = (await import('./providers/csv-import.provider')).csvImportProvider
    const spy = vi.spyOn(csv, 'isCompliant').mockResolvedValueOnce({
      status: 'UNVERIFIED',
      checkedAt: new Date().toISOString(),
      notes: 'test',
    })
    await expect(getVerifiedProvider('csv-import')).rejects.toBeInstanceOf(
      ProviderNotVerifiedError,
    )
    spy.mockRestore()
  })
})
