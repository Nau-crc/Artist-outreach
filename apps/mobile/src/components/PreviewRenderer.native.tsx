import { Text, View } from 'react-native'

/**
 * En nativo mostramos el HTML como texto plano — es suficiente para
 * un preview de qué se va a enviar. El WYSIWYG completo vive en web.
 */
export function PreviewRenderer({ html }: { html: string }) {
  const paragraphs = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n{2,}/)
  return (
    <View className="gap-2">
      {paragraphs.map((p, i) => (
        <Text key={i} className="text-sm text-text-primary leading-6 whitespace-pre-wrap">
          {p}
        </Text>
      ))}
    </View>
  )
}
