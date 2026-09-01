import { Badge } from '../../atoms/Badge'
import { statusToneAndLabel } from './statusMap'
import type { StatusPillProps } from './StatusPill.types'

export function StatusPill({ kind, value, testID }: StatusPillProps) {
  const { tone, label } = statusToneAndLabel(kind, value)
  return (
    <Badge tone={tone} testID={testID}>
      {label}
    </Badge>
  )
}
