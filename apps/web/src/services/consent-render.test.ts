import { describe, expect, it } from 'vitest'
import type { Contact } from '@prisma/client'
import { renderConsentEmail } from './consent-render'
import type { TemplateSnapshot } from '@/models/consent-requests.model'

const CONTACT: Contact = {
  id: 'c1',
  artistName: 'Ana Luz',
  email: 'ana@example.com',
  website: null,
  discipline: null,
  country: null,
  city: null,
  language: null,
  contactStatus: 'REVIEWED',
  emailStatus: 'FOUND',
  consentStatus: 'UNKNOWN',
  permission: 'ELIGIBLE',
  lastActionAt: null,
  reviewedAt: null,
  reviewedBy: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const SNAP: TemplateSnapshot = {
  version: 3,
  subject: 'Hola {{ artistName }}',
  text: 'Hola {{ artistName }}. Confirmar: {{ confirmUrl }}. Baja: {{ unsubscribeUrl }}.',
  html: '<p>Hola {{ artistName }}. <a href="{{ confirmUrl }}">Confirmar</a> · <a href="{{ unsubscribeUrl }}">Baja</a></p>',
}

describe('renderConsentEmail', () => {
  it('sustituye artistName + confirmUrl + unsubscribeUrl con URLs canónicas', () => {
    const r = renderConsentEmail(SNAP, CONTACT, 'tok123', 'https://app.example.com')
    expect(r.subject).toBe('Hola Ana Luz')
    expect(r.text).toContain('Ana Luz')
    expect(r.text).toContain('https://app.example.com/consent/tok123')
    expect(r.text).toContain('https://app.example.com/consent/tok123?action=decline')
    expect(r.html).toContain('href="https://app.example.com/consent/tok123"')
  })

  it('URL-encodea el token', () => {
    const r = renderConsentEmail(SNAP, CONTACT, 'tok/needs?encoding', 'https://x.com')
    expect(r.html).toContain('tok%2Fneeds%3Fencoding')
  })

  it('artistName fallback a "artista" si vacío', () => {
    const r = renderConsentEmail(SNAP, { ...CONTACT, artistName: '' }, 'tok', 'https://x.com')
    expect(r.subject).toBe('Hola artista')
  })

  it('elimina slashes finales del appUrl', () => {
    const r = renderConsentEmail(SNAP, CONTACT, 'tok', 'https://x.com/')
    expect(r.text).toContain('https://x.com/consent/tok')
    expect(r.text).not.toContain('x.com//consent')
  })
})
