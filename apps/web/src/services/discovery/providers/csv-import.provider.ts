import { parse } from 'csv-parse/sync'
import type {
  ComplianceCheck,
  CsvColumnMapping,
  CsvPreviewResult,
  CsvPreviewRow,
  DiscoveryResult,
  DiscoverySearchParams,
} from '@artist-outreach/shared'
import type { DiscoveryProvider } from '../discovery.provider'
import { normalize } from '../normalize'

const MAX_ROWS = 5000
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const PREVIEW_ROWS = 20

export class CsvTooLargeError extends Error {
  constructor(bytes: number) {
    super(`CSV too large: ${bytes} bytes (max ${MAX_BYTES})`)
    this.name = 'CsvTooLargeError'
  }
}

export class CsvTooManyRowsError extends Error {
  constructor(rows: number) {
    super(`CSV has too many rows: ${rows} (max ${MAX_ROWS})`)
    this.name = 'CsvTooManyRowsError'
  }
}

export class InvalidCsvError extends Error {
  constructor(message: string) {
    super(`Invalid CSV: ${message}`)
    this.name = 'InvalidCsvError'
  }
}

interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

function parseCsv(text: string): ParsedCsv {
  const bytes = new TextEncoder().encode(text).byteLength
  if (bytes > MAX_BYTES) throw new CsvTooLargeError(bytes)

  let rows: Record<string, string>[]
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[]
  } catch (err) {
    throw new InvalidCsvError((err as Error).message)
  }

  if (rows.length > MAX_ROWS) throw new CsvTooManyRowsError(rows.length)

  const headers = rows.length > 0 && rows[0] ? Object.keys(rows[0]) : []
  return { headers, rows }
}

/**
 * Sugiere un mapping columna → campo de dominio basado en heurísticas
 * simples de nombre de columna.
 */
export function sniffMapping(headers: string[]): Partial<CsvColumnMapping> {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, '')
  const map: Partial<CsvColumnMapping> = {}
  const patterns: Array<[keyof CsvColumnMapping, RegExp]> = [
    ['artistName', /^(artist|artistname|name|nombre|artista)$/],
    ['email', /^(email|correo|mail|e-?mail)$/],
    ['website', /^(website|web|url|site|sitio)$/],
    ['discipline', /^(discipline|disciplina|genre|género|genero|category|categoria|categoría)$/],
    ['country', /^(country|país|pais|country_code|paíscodigo)$/],
    ['city', /^(city|ciudad|town|localidad)$/],
    ['language', /^(language|lang|idioma)$/],
  ]

  for (const header of headers) {
    const key = norm(header)
    for (const [field, pattern] of patterns) {
      if (pattern.test(key) && !map[field]) {
        map[field] = header
        break
      }
    }
  }
  return map
}

/**
 * Convierte una fila CSV en DiscoveryResult a través del mapping.
 * Devuelve { result, errors }. errors se rellena si faltan campos requeridos.
 */
export function rowToResult(
  row: Record<string, string>,
  mapping: CsvColumnMapping,
  sourceUrl: string,
): { result: DiscoveryResult | null; errors: string[] } {
  const errors: string[] = []
  const artistName = (row[mapping.artistName] ?? '').trim()
  if (!artistName) {
    errors.push('Falta artistName')
    return { result: null, errors }
  }

  const raw: DiscoveryResult = {
    artistName,
    email: mapping.email ? (row[mapping.email] ?? null) : null,
    website: mapping.website ? (row[mapping.website] ?? null) : null,
    discipline: mapping.discipline ? (row[mapping.discipline] ?? null) : null,
    country: mapping.country ? (row[mapping.country] ?? null) : null,
    city: mapping.city ? (row[mapping.city] ?? null) : null,
    language: mapping.language ? (row[mapping.language] ?? null) : null,
    source: 'csv-import',
    sourceUrl,
    discoveredAt: new Date().toISOString(),
    raw: row,
  }
  const normalized = normalize(raw)
  if (!normalized) errors.push('Fila no normalizable')
  return { result: normalized, errors }
}

export function previewCsv(text: string, mapping?: Partial<CsvColumnMapping>): CsvPreviewResult {
  const { headers, rows } = parseCsv(text)
  const suggested = sniffMapping(headers)
  const activeMapping: CsvColumnMapping = {
    artistName: mapping?.artistName ?? suggested.artistName ?? '',
    ...(mapping?.email !== undefined ? { email: mapping.email } : suggested.email !== undefined ? { email: suggested.email } : {}),
    ...(mapping?.website !== undefined ? { website: mapping.website } : suggested.website !== undefined ? { website: suggested.website } : {}),
    ...(mapping?.discipline !== undefined ? { discipline: mapping.discipline } : suggested.discipline !== undefined ? { discipline: suggested.discipline } : {}),
    ...(mapping?.country !== undefined ? { country: mapping.country } : suggested.country !== undefined ? { country: suggested.country } : {}),
    ...(mapping?.city !== undefined ? { city: mapping.city } : suggested.city !== undefined ? { city: suggested.city } : {}),
    ...(mapping?.language !== undefined ? { language: mapping.language } : suggested.language !== undefined ? { language: suggested.language } : {}),
  }

  const previewRows: CsvPreviewRow[] = []
  let validCount = 0
  let invalidCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    let entry: CsvPreviewRow
    if (activeMapping.artistName) {
      const { result, errors } = rowToResult(row, activeMapping, `csv://row/${i + 1}`)
      if (result) validCount++
      else invalidCount++
      entry = { index: i, raw: row, normalized: result, errors }
    } else {
      invalidCount++
      entry = { index: i, raw: row, normalized: null, errors: ['Falta mapping para artistName'] }
    }
    if (i < PREVIEW_ROWS) previewRows.push(entry)
  }

  return {
    detectedHeaders: headers,
    suggestedMapping: suggested,
    rows: previewRows,
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
  }
}

export function parseCsvToResults(text: string, mapping: CsvColumnMapping): DiscoveryResult[] {
  if (!mapping.artistName) throw new InvalidCsvError('Mapping requires artistName')
  const { rows } = parseCsv(text)
  const results: DiscoveryResult[] = []
  for (let i = 0; i < rows.length; i++) {
    const { result } = rowToResult(rows[i]!, mapping, `csv://row/${i + 1}`)
    if (result) results.push(result)
  }
  return results
}

// ────────────────────────────────────────────────────────────────
// DiscoveryProvider interface (para el registry).
// CSV no soporta `search` con params — su flujo pasa por previewCsv +
// commitCsv en el model. El método aquí lanza intencionalmente.
// ────────────────────────────────────────────────────────────────

export const csvImportProvider: DiscoveryProvider = {
  slug: 'csv-import',
  name: 'Importación CSV',
  type: 'CSV',
  requiresApiKey: false,
  async isCompliant(): Promise<ComplianceCheck> {
    return {
      status: 'VERIFIED',
      checkedAt: new Date().toISOString(),
      notes: 'CSV proporcionado por el operador; su procedencia es responsabilidad de quien importa.',
    }
  },
  async search(_params: DiscoverySearchParams): Promise<DiscoveryResult[]> {
    throw new Error(
      'csv-import no soporta search(). Usa previewCsv() + commitCsv() en discovery.model.',
    )
  },
}
