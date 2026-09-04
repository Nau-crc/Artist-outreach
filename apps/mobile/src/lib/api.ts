import Constants from 'expo-constants'
import { supabase } from './supabase'

const API_URL_ENV =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL

// Si EXPO_PUBLIC_API_URL está vacía o no definida, usamos paths relativos.
// Sirve para el deploy monolítico donde el admin vive bajo /admin en el
// mismo origen que la API (fetch('/api/...') resuelve al mismo host).
// En dev con Expo Web local (localhost:8081) o binario móvil, ponemos
// EXPO_PUBLIC_API_URL=http://localhost:3000 (o la URL de Vercel).
const API_URL = API_URL_ENV && API_URL_ENV.trim() !== '' ? API_URL_ENV : ''

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
    this.name = 'ApiError'
  }
}

async function bearer(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await bearer()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  const text = await res.text()
  const body = text ? safeJson(text) : undefined
  if (!res.ok) {
    const errMsg = typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`
    throw new ApiError(res.status, body, errMsg)
  }
  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ────────────────────────────────────────────────────────────────
// Endpoints
// ────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  service: string
  version: string
  time: string
}

export interface AppConfig {
  id: number
  sendingEnabled: boolean
  campaignEnabled: boolean
  dailySendLimit: number
  hourlySendLimit: number
  minIntervalSeconds: number
  consentRequestCooldownDays: number
  updatedAt: string
  updatedBy: string | null
}

export interface Contact {
  id: string
  artistName: string
  email: string | null
  website: string | null
  discipline: string | null
  country: string | null
  city: string | null
  language: string | null
  contactStatus: 'DISCOVERED' | 'REVIEW_REQUIRED' | 'REVIEWED' | 'DISCARDED' | 'SUPPRESSED'
  emailStatus: 'NOT_FOUND' | 'FOUND' | 'INVALID' | 'BOUNCED'
  consentStatus: 'UNKNOWN' | 'REQUESTED' | 'PENDING' | 'CONFIRMED' | 'WITHDRAWN'
  permission: 'NOT_REVIEWED' | 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'BLOCKED'
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  notes: string | null
}

export interface AuditLog {
  id: string
  at: string
  actorId: string | null
  actorKind: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'PUBLIC'
  entityType: string
  entityId: string | null
  action: string
  metadata: Record<string, unknown> | null
}

export interface EligibilityReport {
  eligible: boolean
  rules: Array<{ id: string; description: string; passed: boolean; detail?: string }>
}

export type ReviewDecision =
  | { kind: 'APPROVE' }
  | { kind: 'DISCARD'; reason?: string }
  | { kind: 'SUPPRESS'; reason?: string }

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
  normalized: unknown | null
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

export interface CsvCommitReport {
  run: {
    id: string
    status: string
    resultsCount: number
    newContactsCount: number
    finishedAt: string | null
  }
  resultsCount: number
  newContactsCount: number
  duplicates: Array<{ artistName: string; existingId: string }>
  suppressed: number
}

export const api = {
  async health(): Promise<HealthResponse> {
    return request('/api/health')
  },
  async getConfig(): Promise<AppConfig> {
    return request('/api/config')
  },
  async updateConfig(patch: Partial<Omit<AppConfig, 'id' | 'updatedAt' | 'updatedBy'>>): Promise<AppConfig> {
    return request('/api/config', { method: 'PATCH', body: JSON.stringify(patch) })
  },
  async listContacts(params: {
    contactStatus?: Contact['contactStatus']
    permission?: Contact['permission']
    search?: string
    limit?: number
  } = {}): Promise<Contact[]> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    }
    const query = qs.toString()
    return request(`/api/contacts${query ? `?${query}` : ''}`)
  },
  async getContact(id: string): Promise<Contact & { contactSources: unknown[] }> {
    return request(`/api/contacts/${id}`)
  },
  async reviewContact(id: string, decision: ReviewDecision): Promise<Contact> {
    return request(`/api/contacts/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(decision),
    })
  },
  async dryRunEligibility(id: string): Promise<EligibilityReport> {
    return request(`/api/contacts/${id}/eligibility`)
  },
  async listAudit(params: { entityType?: string; limit?: number } = {}): Promise<AuditLog[]> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v))
    }
    const query = qs.toString()
    return request(`/api/audit${query ? `?${query}` : ''}`)
  },
  async previewCsv(csvText: string, mapping?: Partial<CsvColumnMapping>): Promise<CsvPreviewResult> {
    return request('/api/discovery/csv/preview', {
      method: 'POST',
      body: JSON.stringify({ csvText, mapping }),
    })
  },
  async commitCsv(csvText: string, mapping: CsvColumnMapping): Promise<CsvCommitReport> {
    return request('/api/discovery/csv/commit', {
      method: 'POST',
      body: JSON.stringify({ csvText, mapping }),
    })
  },

  // ─── Templates ─────────────────────────────────────────────
  async listTemplates(params: { active?: boolean } = {}): Promise<Template[]> {
    const qs = new URLSearchParams()
    if (params.active !== undefined) qs.set('active', String(params.active))
    return request(`/api/templates${qs.toString() ? `?${qs}` : ''}`)
  },
  async getTemplate(id: string): Promise<Template> {
    return request(`/api/templates/${id}`)
  },
  async createTemplate(input: {
    name: string
    subject: string
    bodyHtml: string
    bodyText: string
    active?: boolean
  }): Promise<Template> {
    return request('/api/templates', { method: 'POST', body: JSON.stringify(input) })
  },
  async updateTemplate(id: string, patch: Partial<{
    name: string
    subject: string
    bodyHtml: string
    bodyText: string
    active: boolean
  }>): Promise<Template> {
    return request(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  },
  async deleteTemplate(id: string): Promise<void> {
    await request(`/api/templates/${id}`, { method: 'DELETE' })
  },
  async previewTemplate(id: string, vars: {
    artistName?: string
    confirmUrl?: string
    unsubscribeUrl?: string
  } = {}): Promise<{ subject: string; html: string; text: string; version: number }> {
    return request(`/api/templates/${id}/preview`, { method: 'POST', body: JSON.stringify(vars) })
  },

  // ─── Campaigns ─────────────────────────────────────────────
  async listCampaigns(params: { active?: boolean } = {}): Promise<Campaign[]> {
    const qs = new URLSearchParams()
    if (params.active !== undefined) qs.set('active', String(params.active))
    return request(`/api/campaigns${qs.toString() ? `?${qs}` : ''}`)
  },
  async getCampaign(id: string): Promise<Campaign> {
    return request(`/api/campaigns/${id}`)
  },
  async createCampaign(input: {
    name: string
    active?: boolean
    startsAt?: string | null
    endsAt?: string | null
    maxSends?: number | null
  }): Promise<Campaign> {
    return request('/api/campaigns', { method: 'POST', body: JSON.stringify(input) })
  },
  async updateCampaign(id: string, patch: Partial<{
    name: string
    active: boolean
    startsAt: string | null
    endsAt: string | null
    maxSends: number | null
  }>): Promise<Campaign> {
    return request(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  },
  async deleteCampaign(id: string): Promise<void> {
    await request(`/api/campaigns/${id}`, { method: 'DELETE' })
  },

  // ─── Consent requests ─────────────────────────────────────
  async listConsentRequests(params: {
    status?: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
    contactId?: string
    campaignId?: string
    limit?: number
  } = {}): Promise<ConsentRequest[]> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v))
    }
    return request(`/api/consent-requests${qs.toString() ? `?${qs}` : ''}`)
  },
  async enqueueConsentRequest(input: {
    contactId: string
    campaignId: string
    templateId: string
  }): Promise<{ status: 'ENQUEUED' | 'NOT_ELIGIBLE'; request?: ConsentRequest; reasons?: string[] }> {
    return request('/api/consent-requests', { method: 'POST', body: JSON.stringify(input) })
  },
  async cancelConsentRequest(id: string): Promise<void> {
    await request(`/api/consent-requests/${id}`, { method: 'DELETE' })
  },
  async simulateConsentRequests(input: {
    campaignId?: string
    templateId?: string
    limit?: number
  }): Promise<SimulationResult> {
    return request('/api/consent-requests/simulate', { method: 'POST', body: JSON.stringify(input) })
  },

  // ─── Web sources (core: extracción autorizada) ────────────
  async listWebSources(): Promise<WebSource[]> {
    return request('/api/discovery/web-sources')
  },
  async getWebSource(id: string): Promise<WebSource> {
    return request(`/api/discovery/web-sources/${id}`)
  },
  async createWebSource(input: {
    name: string
    url: string
    complianceNotes?: string
    termsUrl?: string
  }): Promise<WebSource> {
    return request('/api/discovery/web-sources', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async verifyWebSource(id: string, input: {
    authorizationRef: string
    complianceNotes: string
  }): Promise<WebSource> {
    return request(`/api/discovery/web-sources/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async unverifyWebSource(id: string, reason: string): Promise<WebSource> {
    return request(`/api/discovery/web-sources/${id}/verify`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    })
  },
  async checkWebSourceRobots(id: string): Promise<RobotsCheckResult> {
    return request(`/api/discovery/web-sources/${id}/check-robots`, { method: 'POST' })
  },
  async extractFromWebSource(id: string, opts: {
    maxPages?: number
    maxDepth?: number
    rateLimitMs?: number
  }): Promise<ExtractReport> {
    return request(`/api/discovery/web-sources/${id}/extract`, {
      method: 'POST',
      body: JSON.stringify(opts),
    })
  },
}

// ────────────────────────────────────────────────────────────────
// Newly added types
// ────────────────────────────────────────────────────────────────

export interface Template {
  id: string
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  version: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Campaign {
  id: string
  name: string
  active: boolean
  startsAt: string | null
  endsAt: string | null
  maxSends: number | null
  createdAt: string
  updatedAt: string
}

export interface ConsentRequest {
  id: string
  contactId: string
  campaignId: string
  templateId: string
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
  token: string
  sentAt: string | null
  createdAt: string
  contact?: { id: string; artistName: string; email: string | null }
  campaign?: { id: string; name: string; active: boolean }
  template?: { id: string; name: string; version: number }
}

export interface SimulationResult {
  totalEvaluated: number
  eligible: number
  notEligible: number
  suppressed: number
  reasonsBreakdown: Record<string, number>
  sample: Array<{
    contactId: string
    artistName: string
    email: string | null
    eligible: boolean
    failingRules: string[]
  }>
}

export interface WebSource {
  id: string
  slug: string
  name: string
  type: 'API' | 'DIRECTORY' | 'CSV' | 'MANUAL'
  complianceStatus: 'VERIFIED' | 'UNVERIFIED' | 'PROHIBITED'
  complianceNotes: string | null
  termsUrl: string | null
  enabled: boolean
  config: { startUrl?: string; host?: string } | Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RobotsCheckResult {
  allowed: boolean
  crawlDelayMs: number
  reason: 'robots_allowed' | 'robots_disallowed' | 'robots_missing' | 'robots_error'
  robotsUrl: string
}

export interface ExtractReport {
  run: {
    id: string
    status: string
    resultsCount: number
    newContactsCount: number
    finishedAt: string | null
    error: string | null
  }
  crawl: {
    visitedCount: number
    emailsCount: number
    aborted: boolean
    abortReason?: string
    pages: Array<{
      url: string
      depth: number
      status: number | 'skipped_robots' | 'error'
      emailsFound: number
      error?: string
    }>
  }
  persisted: {
    resultsCount: number
    newContactsCount: number
    duplicates: Array<{ artistName: string; existingId: string }>
    suppressed: number
  }
}

export async function checkHealth(): Promise<HealthResponse> {
  return api.health()
}
