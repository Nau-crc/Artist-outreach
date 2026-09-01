import type { DiscoveryProvider } from './discovery.provider'
import { csvImportProvider } from './providers/csv-import.provider'
import { musicbrainzProvider } from './providers/musicbrainz.provider'

const registry = new Map<string, DiscoveryProvider>()

function register(provider: DiscoveryProvider): void {
  if (registry.has(provider.slug)) {
    throw new Error(`Discovery provider ${provider.slug} already registered`)
  }
  registry.set(provider.slug, provider)
}

register(csvImportProvider)
register(musicbrainzProvider)

export function getProvider(slug: string): DiscoveryProvider | undefined {
  return registry.get(slug)
}

export function listProviders(): DiscoveryProvider[] {
  return Array.from(registry.values())
}

export class ProviderNotVerifiedError extends Error {
  readonly slug: string
  readonly status: string
  constructor(slug: string, status: string) {
    super(`Provider ${slug} is not verified (status=${status}); cannot run`)
    this.name = 'ProviderNotVerifiedError'
    this.slug = slug
    this.status = status
  }
}

/**
 * Devuelve el provider solo si su compliance está VERIFIED.
 * Los providers UNVERIFIED o PROHIBITED lanzan ProviderNotVerifiedError.
 */
export async function getVerifiedProvider(slug: string): Promise<DiscoveryProvider> {
  const provider = registry.get(slug)
  if (!provider) throw new Error(`Unknown discovery provider: ${slug}`)
  const check = await provider.isCompliant()
  if (check.status !== 'VERIFIED') {
    throw new ProviderNotVerifiedError(slug, check.status)
  }
  return provider
}
