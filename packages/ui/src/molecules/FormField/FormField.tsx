import type { FormFieldProps } from './FormField.types'

export function FormField({ label, hint, error, required, children, testID }: FormFieldProps) {
  return (
    <div data-testid={testID} className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-status-notEligible ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-status-notEligible">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
