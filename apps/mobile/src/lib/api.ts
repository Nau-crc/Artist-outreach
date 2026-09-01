import Constants from 'expo-constants'
import { supabase } from './supabase'

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000'

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
}

export async function checkHealth(): Promise<HealthResponse> {
  return api.health()
}
