import type {
  ComplianceCheck,
  DiscoveryResult,
  DiscoverySearchParams,
} from '@artist-outreach/shared'

export type {
  ComplianceCheck,
  ComplianceStatus,
  DiscoveryResult,
  DiscoverySearchParams,
} from '@artist-outreach/shared'

export interface DiscoveryProvider {
  readonly slug: string
  readonly name: string
  readonly type: 'API' | 'DIRECTORY' | 'CSV' | 'MANUAL'
  readonly requiresApiKey: boolean
  isCompliant(): Promise<ComplianceCheck>
  search(params: DiscoverySearchParams): Promise<DiscoveryResult[]>
}
