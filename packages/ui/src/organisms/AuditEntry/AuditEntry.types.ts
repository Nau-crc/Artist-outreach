export interface AuditEntryData {
  id: string
  at: string
  actorKind: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'PUBLIC'
  entityType: string
  entityId: string | null
  action: string
  metadata?: Record<string, unknown> | null
}

export interface AuditEntryProps {
  entry: AuditEntryData
  testID?: string
}
