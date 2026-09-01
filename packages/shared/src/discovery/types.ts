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
  email?: string | null
  website?: string | null
  discipline?: string | null
  country?: string | null
  city?: string | null
  language?: string | null
  source: string
  sourceUrl: string
  discoveredAt: string
  raw?: unknown
}

export type ComplianceStatus = 'VERIFIED' | 'UNVERIFIED' | 'PROHIBITED'

export interface ComplianceCheck {
  status: ComplianceStatus
  checkedAt: string
  notes?: string
}

export interface CsvColumnMapping {
  artistName: string
  email?: string
  website?: string
  discipline?: string
  country?: string
  city?: string
  language?: string
}

export interface CsvPreviewRow {
  index: number
  raw: Record<string, string>
  normalized: DiscoveryResult | null
  errors: string[]
}

export interface CsvPreviewResult {
  detectedHeaders: string[]
  suggestedMapping: Partial<CsvColumnMapping>
  rows: CsvPreviewRow[]
  totalRows: number
  validRows: number
  invalidRows: number
}
