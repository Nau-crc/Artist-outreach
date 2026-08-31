// Interface de discovery. Adapters concretos en fase 3.

export interface DiscoverySearchParams {
  discipline?: string
  country?: string
  city?: string
  language?: string
  keywords?: string[]
  maxResults: number
}

export interface DiscoveryResult {
  artistName: string
  email?: string
  website?: string
  discipline?: string
  country?: string
  city?: string
  source: string
  sourceUrl: string
  discoveredAt: string
  raw?: unknown
}

export interface ComplianceCheck {
  status: 'VERIFIED' | 'UNVERIFIED' | 'PROHIBITED'
  checkedAt: string
  notes?: string
}

export interface DiscoveryProvider {
  readonly id: string
  readonly requiresApiKey: boolean
  isCompliant(): Promise<ComplianceCheck>
  search(params: DiscoverySearchParams): Promise<DiscoveryResult[]>
}
