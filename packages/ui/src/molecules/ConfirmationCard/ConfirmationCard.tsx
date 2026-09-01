import clsx from 'clsx'
import type { ConfirmationCardProps, ConfirmationVariant } from './ConfirmationCard.types'

const variantClasses: Record<ConfirmationVariant, string> = {
  success: 'bg-status-eligible/10 border-status-eligible/30',
  info: 'bg-brand-50 border-brand-100',
  warning: 'bg-status-reviewRequired/10 border-status-reviewRequired/30',
  error: 'bg-status-notEligible/10 border-status-notEligible/30',
}

const titleColor: Record<ConfirmationVariant, string> = {
  success: 'text-status-eligible',
  info: 'text-brand-700',
  warning: 'text-status-reviewRequired',
  error: 'text-status-notEligible',
}

export function ConfirmationCard({
  variant = 'success',
  title,
  description,
  action,
  testID,
}: ConfirmationCardProps) {
  return (
    <div
      data-testid={testID}
      className={clsx('p-6 rounded-lg border flex flex-col gap-3', variantClasses[variant])}
    >
      <h3 className={clsx('text-lg font-semibold', titleColor[variant])}>{title}</h3>
      {description && <p className="text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
