import type { PublicLandingProps } from './PublicLanding.types'

export function PublicLanding({ title, subtitle, children, footer, testID }: PublicLandingProps) {
  return (
    <main
      data-testid={testID}
      className="min-h-screen bg-surface-base text-text-primary flex flex-col items-center justify-start px-6 py-12"
    >
      <div className="w-full max-w-md flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="text-base text-text-secondary">{subtitle}</p>}
        </header>
        <section className="flex flex-col gap-4">{children}</section>
        {footer && (
          <footer className="text-xs text-text-muted mt-8 pt-6 border-t border-border-subtle">
            {footer}
          </footer>
        )}
      </div>
    </main>
  )
}
