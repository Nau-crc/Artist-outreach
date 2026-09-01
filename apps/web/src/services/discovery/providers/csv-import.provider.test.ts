import { describe, expect, it } from 'vitest'
import {
  CsvTooLargeError,
  CsvTooManyRowsError,
  InvalidCsvError,
  parseCsvToResults,
  previewCsv,
  sniffMapping,
} from './csv-import.provider'

describe('sniffMapping', () => {
  it('maps common headers case-insensitively', () => {
    const m = sniffMapping(['Artist', 'Email', 'Website', 'Discipline', 'Country', 'City'])
    expect(m.artistName).toBe('Artist')
    expect(m.email).toBe('Email')
    expect(m.website).toBe('Website')
    expect(m.discipline).toBe('Discipline')
    expect(m.country).toBe('Country')
    expect(m.city).toBe('City')
  })

  it('recognises Spanish column names', () => {
    const m = sniffMapping(['Nombre', 'Correo', 'Web', 'Ciudad'])
    expect(m.artistName).toBe('Nombre')
    expect(m.email).toBe('Correo')
    expect(m.website).toBe('Web')
    expect(m.city).toBe('Ciudad')
  })

  it('ignores unknown headers', () => {
    const m = sniffMapping(['XYZ', 'ABC'])
    expect(Object.keys(m)).toHaveLength(0)
  })
})

describe('previewCsv', () => {
  it('detects headers, sniffs mapping and normalizes rows', () => {
    const csv = [
      'artist,email,country',
      'Ana Luz,Ana@Example.COM,es',
      'Diego Arriaga,diego@example.com,cl',
    ].join('\n')
    const result = previewCsv(csv)
    expect(result.detectedHeaders).toEqual(['artist', 'email', 'country'])
    expect(result.suggestedMapping.artistName).toBe('artist')
    expect(result.totalRows).toBe(2)
    expect(result.validRows).toBe(2)
    expect(result.invalidRows).toBe(0)
    expect(result.rows[0]?.normalized?.email).toBe('ana@example.com')
    expect(result.rows[0]?.normalized?.country).toBe('ES')
  })

  it('marks rows without artistName as invalid', () => {
    const csv = ['name,email', ',foo@x.com', 'Bob,bob@x.com'].join('\n')
    const result = previewCsv(csv)
    expect(result.validRows).toBe(1)
    expect(result.invalidRows).toBe(1)
    expect(result.rows[0]?.errors).toContain('Falta artistName')
  })

  it('caps preview at 20 rows', () => {
    const rows = ['name']
    for (let i = 0; i < 50; i++) rows.push(`Artist ${i}`)
    const result = previewCsv(rows.join('\n'))
    expect(result.totalRows).toBe(50)
    expect(result.rows).toHaveLength(20)
  })

  it('accepts BOM and mixed line endings', () => {
    const csv = '﻿name\r\nAna\r\nBob'
    const result = previewCsv(csv)
    expect(result.detectedHeaders).toEqual(['name'])
    expect(result.totalRows).toBe(2)
  })

  it('rejects invalid CSV', () => {
    expect(() => previewCsv('"unterminated')).toThrow(InvalidCsvError)
  })

  it('rejects CSV over size limit', () => {
    const huge = 'x,'.repeat(3_000_000) + '\n'
    expect(() => previewCsv(huge)).toThrow(CsvTooLargeError)
  })

  it('rejects CSV with too many rows', () => {
    const rows = ['name']
    for (let i = 0; i < 5001; i++) rows.push(`A${i}`)
    expect(() => previewCsv(rows.join('\n'))).toThrow(CsvTooManyRowsError)
  })
})

describe('parseCsvToResults', () => {
  it('produces DiscoveryResults for valid rows', () => {
    const csv = ['name,email', 'Ana,ana@x.com', 'Bob,bob@x.com'].join('\n')
    const results = parseCsvToResults(csv, { artistName: 'name', email: 'email' })
    expect(results).toHaveLength(2)
    expect(results[0]?.source).toBe('csv-import')
    expect(results[0]?.email).toBe('ana@x.com')
  })

  it('silently drops rows without artistName', () => {
    const csv = ['name,email', ',foo@x.com', 'Bob,bob@x.com'].join('\n')
    const results = parseCsvToResults(csv, { artistName: 'name', email: 'email' })
    expect(results).toHaveLength(1)
    expect(results[0]?.artistName).toBe('Bob')
  })

  it('drops invalid emails but keeps the row', () => {
    const csv = ['name,email', 'Ana,not-an-email'].join('\n')
    const results = parseCsvToResults(csv, { artistName: 'name', email: 'email' })
    expect(results).toHaveLength(1)
    expect(results[0]?.email).toBeNull()
  })
})
