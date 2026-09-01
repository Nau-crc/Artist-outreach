import { Text, View } from 'react-native'
import type { FormFieldProps } from './FormField.types'

export function FormField({ label, hint, error, required, children, testID }: FormFieldProps) {
  return (
    <View testID={testID} className="flex-col gap-1">
      <Text className="text-sm font-medium text-text-primary">
        {label}
        {required ? <Text className="text-status-notEligible">{' *'}</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text className="text-xs text-status-notEligible">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-text-muted">{hint}</Text>
      ) : null}
    </View>
  )
}
