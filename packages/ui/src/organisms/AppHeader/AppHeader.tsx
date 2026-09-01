import type { AppHeaderProps } from './AppHeader.types'

export function AppHeader({ title, subtitle, trailing, testID }: AppHeaderProps) {
  return (
    <header
      data-testid={testID}
      className="flex items-center justify-between px-6 py-4 border-b border-border-subtle"
    >
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </header>
  )
}
