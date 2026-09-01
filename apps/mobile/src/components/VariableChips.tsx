import { View } from 'react-native'
import { Button } from '@artist-outreach/ui/atoms'

export interface VariableChipsProps {
  target: 'subject' | 'body'
  onInsert: (variable: string) => void
}

const OPTIONS: Record<VariableChipsProps['target'], Array<{ label: string; value: string }>> = {
  subject: [{ label: '+ Nombre del artista', value: '{{ artistName }}' }],
  body: [
    { label: '+ Nombre del artista', value: '{{ artistName }}' },
    { label: '+ Link de confirmación', value: '{{ confirmUrl }}' },
    { label: '+ Link de baja', value: '{{ unsubscribeUrl }}' },
  ],
}

export function VariableChips({ target, onInsert }: VariableChipsProps) {
  return (
    <View className="flex-row flex-wrap gap-2 mt-1">
      {OPTIONS[target].map((opt) => (
        <Button key={opt.value} size="sm" variant="secondary" onPress={() => onInsert(opt.value)}>
          {opt.label}
        </Button>
      ))}
    </View>
  )
}

/**
 * Appendea `variable` al valor existente con separador apropiado:
 * - Espacio si la última posición no es whitespace y el texto no está vacío.
 * - Sin nada si termina en espacio o newline.
 */
export function appendVariable(current: string, variable: string): string {
  if (current === '') return variable
  const last = current[current.length - 1]!
  if (last === ' ' || last === '\n') return current + variable
  return `${current} ${variable}`
}
