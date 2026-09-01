import { View } from 'react-native'
import { Input } from '@artist-outreach/ui/atoms'
import { VariableChips, appendVariable } from './VariableChips'
import type { RichTextEditorProps } from './RichTextEditor.types'
import { textToHtml } from '@/lib/text-to-html'

/**
 * Fallback nativo: editor de texto plano con chips.
 * En iOS/Android no cargamos TipTap (depende de DOM). El operador usa
 * la app en web para tener el WYSIWYG completo; en móvil edita texto
 * y el HTML se genera al guardar (mismo pipeline que antes).
 */
export function RichTextEditor({ valueHtml, onChangeHtml, testID }: RichTextEditorProps) {
  // Convierte HTML entrante a texto plano de manera simple para editarlo.
  const currentText = htmlToText(valueHtml)

  function setText(text: string) {
    onChangeHtml(textToHtml(text))
  }

  return (
    <View className="gap-2">
      <Input value={currentText} onChange={setText} multiline rows={14} testID={testID} />
      <VariableChips
        target="body"
        onInsert={(v) => setText(appendVariable(currentText, v))}
      />
    </View>
  )
}

function htmlToText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}
