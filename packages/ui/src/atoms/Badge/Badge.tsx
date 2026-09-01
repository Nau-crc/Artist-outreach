import clsx from 'clsx'
import type { BadgeProps, BadgeTone } from './Badge.types'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-status-eligible/15 text-status-eligible',
  warning: 'bg-status-reviewRequired/15 text-status-reviewRequired',
  danger: 'bg-status-notEligible/15 text-status-notEligible',
  muted: 'bg-surface-subtle text-text-muted',
}

export function Badge({ children, tone = 'neutral', testID }: BadgeProps) {
  return (
    <span
      data-testid={testID}
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  )
}
