import { Badge } from '../../atoms/Badge'
import type { AuditEntryProps } from './AuditEntry.types'

const actorTone = {
  USER: 'brand',
  SYSTEM: 'muted',
  WEBHOOK: 'neutral',
  PUBLIC: 'warning',
} as const

export function AuditEntry({ entry, testID }: AuditEntryProps) {
  const when = new Date(entry.at).toLocaleString()
  return (
    <div data-testid={testID} className="py-3 border-b border-border-subtle flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Badge tone={actorTone[entry.actorKind]}>{entry.actorKind}</Badge>
        <span className="text-sm font-medium text-text-primary">{entry.action}</span>
        <span className="text-xs text-text-muted">·</span>
        <span className="text-xs text-text-muted">
          {entry.entityType}
          {entry.entityId ? `#${entry.entityId.slice(0, 8)}` : ''}
        </span>
      </div>
      <span className="text-xs text-text-muted">{when}</span>
    </div>
  )
}
