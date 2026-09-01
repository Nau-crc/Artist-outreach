import type { EmptyStateProps } from './EmptyState.types'

export function EmptyState({ title, description, action, testID }: EmptyStateProps) {
  return (
    <div
      data-testid={testID}
      className="flex flex-col items-center justify-center gap-2 text-center py-12 px-6"
    >
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
