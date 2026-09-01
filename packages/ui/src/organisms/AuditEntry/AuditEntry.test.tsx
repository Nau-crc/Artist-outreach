import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuditEntry } from './AuditEntry'
import type { AuditEntryData } from './AuditEntry.types'

const entry: AuditEntryData = {
  id: 'e1',
  at: '2026-08-31T18:00:00.000Z',
  actorKind: 'USER',
  entityType: 'contact',
  entityId: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb',
  action: 'approved',
}

describe('AuditEntry (web)', () => {
  it('shows action, entity slug and actor badge', () => {
    render(<AuditEntry entry={entry} />)
    expect(screen.getByText('approved')).toBeInTheDocument()
    expect(screen.getByText('USER')).toBeInTheDocument()
    expect(screen.getByText(/contact#aaaaaaaa/)).toBeInTheDocument()
  })

  it('handles null entityId', () => {
    render(<AuditEntry entry={{ ...entry, entityType: 'app_config', entityId: null }} />)
    expect(screen.getByText(/app_config$/)).toBeInTheDocument()
  })
})
