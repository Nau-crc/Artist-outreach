/**
 * Convierte el HTML del editor rich a texto plano razonable para el
 * campo bodyText del template. Preserva estructura básica:
 *   - <p>, </p> → doble newline.
 *   - <br> → newline.
 *   - Listas → bullets con guiones.
 *   - Etiquetas custom .tpl-var (nuestras variables) se preservan como
 *     `{{ variable }}` — el atributo data-variable manda.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  let s = html
  // Preservar variables — sustituir antes de strip.
  s = s.replace(/<span[^>]*data-variable="([^"]+)"[^>]*>[^<]*<\/span>/gi, ' $1 ')
  // Listas.
  s = s.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '')
  s = s.replace(/<\/ul>|<\/ol>/gi, '\n')
  // Párrafos y saltos.
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
  s = s.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n')
  // Headings.
  s = s.replace(/<\/?h[12][^>]*>/gi, '\n')
  // Cualquier otra etiqueta.
  s = s.replace(/<[^>]+>/g, '')
  // Entidades comunes.
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  // Limpieza.
  return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}
