/**
 * Convierte texto plano en HTML seguro para email:
 * - Cada línea vacía separa párrafos.
 * - Los saltos de línea dentro de un párrafo se convierten en <br>.
 * - URLs http(s) se convierten en <a>.
 * - Las variables tipo {{ artistName }} se preservan intactas.
 * - Se escapa HTML del input (nadie mete <script> por accidente).
 */
export function textToHtml(text: string): string {
  const escaped = escapeHtml(text)
  const withLinks = linkify(escaped)
  const paragraphs = withLinks
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;color:#0B0B0F;max-width:560px">${paragraphs}</div>`
}

/**
 * Sustituye las variables plantilla para el preview.
 */
export function fillPreviewVars(source: string): string {
  return source
    .replace(/\{\{\s*artistName\s*\}\}/g, 'Ana Luz')
    .replace(/\{\{\s*confirmUrl\s*\}\}/g, 'https://ejemplo.com/confirmar/TOKEN')
    .replace(/\{\{\s*unsubscribeUrl\s*\}\}/g, 'https://ejemplo.com/baja/TOKEN')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function linkify(s: string): string {
  return s.replace(
    /(https?:\/\/[^\s<]+|\{\{\s*(?:confirmUrl|unsubscribeUrl)\s*\}\})/g,
    (match) =>
      `<a href="${match}" style="color:#4A4EDB;text-decoration:underline">${match}</a>`,
  )
}
