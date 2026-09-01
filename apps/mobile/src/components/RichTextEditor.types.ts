export interface RichTextEditorProps {
  valueHtml: string
  onChangeHtml: (html: string) => void
  placeholder?: string
  testID?: string
}

export const RICH_TEXT_VARIABLES = [
  { label: '+ Nombre del artista', variable: '{{ artistName }}' },
  { label: '+ Link de confirmación', variable: '{{ confirmUrl }}' },
  { label: '+ Link de baja', variable: '{{ unsubscribeUrl }}' },
] as const
