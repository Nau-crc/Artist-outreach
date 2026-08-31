import type { Contact } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/middleware/with-controller'
import {
  createContactController,
  dryRunEligibilityController,
  getContactController,
  listContactsController,
  reviewContactController,
  updateContactController,
} from './contacts.controller'

vi.mock('@/models/contacts.model', () => {
  class ContactNotFoundError extends Error {
    constructor(id: string) {
      super(`Contact ${id} not found`)
      this.name = 'ContactNotFoundError'
    }
  }
  class DuplicateContactError extends Error {
    readonly existingId: string
    constructor(existingId: string) {
      super(`Contact with this email already exists (${existingId})`)
      this.name = 'DuplicateContactError'
      this.existingId = existingId
    }
  }
  class InvalidTransitionError extends Error {
    constructor(from: string, to: string) {
      super(`Invalid contact_status transition: ${from} → ${to}`)
      this.name = 'InvalidTransitionError'
    }
  }
  class SuppressForbiddenError extends Error {
    constructor(msg: string) {
      super(msg)
      this.name = 'SuppressForbiddenError'
    }
  }
  return {
    ContactNotFoundError,
    DuplicateContactError,
    InvalidTransitionError,
    SuppressForbiddenError,
    listContacts: vi.fn(),
    getContact: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    reviewContact: vi.fn(),
    dryRunEligibility: vi.fn(),
  }
})

const model = await import('@/models/contacts.model')

const ACTOR = '88888888-8888-8888-8888-888888888888'
const CONTACT_ID = '99999999-9999-9999-9999-999999999999'

function fakeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: CONTACT_ID,
    artistName: 'X',
    email: null,
    website: null,
    discipline: null,
    country: null,
    city: null,
    language: null,
    contactStatus: 'REVIEW_REQUIRED',
    emailStatus: 'NOT_FOUND',
    consentStatus: 'UNKNOWN',
    permission: 'NOT_REVIEWED',
    lastActionAt: null,
    reviewedAt: null,
    reviewedBy: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('contacts.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list delegates', async () => {
    vi.mocked(model.listContacts).mockResolvedValueOnce([fakeContact()])
    const res = await listContactsController({
      body: { limit: 10 },
      ctx: { params: {}, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res).toHaveLength(1)
    expect(model.listContacts).toHaveBeenCalledWith({ limit: 10 })
  })

  it('get returns contact', async () => {
    vi.mocked(model.getContact).mockResolvedValueOnce(fakeContact() as never)
    const res = await getContactController({
      body: undefined as unknown as void,
      ctx: { params: { id: CONTACT_ID }, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res.id).toBe(CONTACT_ID)
  })

  it('get wraps not found', async () => {
    vi.mocked(model.getContact).mockRejectedValueOnce(new model.ContactNotFoundError(CONTACT_ID))
    await expect(
      getContactController({
        body: undefined as unknown as void,
        ctx: { params: { id: CONTACT_ID }, auth: { userId: ACTOR, role: 'admin' } },
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('create wraps duplicate as Conflict', async () => {
    vi.mocked(model.createContact).mockRejectedValueOnce(
      new model.DuplicateContactError('other-id'),
    )
    await expect(
      createContactController({
        body: { artistName: 'A', email: 'x@y.com' },
        ctx: { params: {}, auth: { userId: ACTOR, role: 'admin' } },
      }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('update passes id + patch + actor', async () => {
    vi.mocked(model.updateContact).mockResolvedValueOnce(fakeContact({ artistName: 'Ana' }))
    const res = await updateContactController({
      body: { artistName: 'Ana' },
      ctx: { params: { id: CONTACT_ID }, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res.artistName).toBe('Ana')
    expect(model.updateContact).toHaveBeenCalledWith(CONTACT_ID, { artistName: 'Ana' }, ACTOR)
  })

  it('review wraps invalid transition as ValidationError', async () => {
    vi.mocked(model.reviewContact).mockRejectedValueOnce(
      new model.InvalidTransitionError('DISCARDED', 'REVIEWED'),
    )
    await expect(
      reviewContactController({
        body: { kind: 'APPROVE' },
        ctx: { params: { id: CONTACT_ID }, auth: { userId: ACTOR, role: 'admin' } },
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('review wraps SuppressForbidden as ValidationError', async () => {
    vi.mocked(model.reviewContact).mockRejectedValueOnce(
      new model.SuppressForbiddenError('no email'),
    )
    await expect(
      reviewContactController({
        body: { kind: 'SUPPRESS' },
        ctx: { params: { id: CONTACT_ID }, auth: { userId: ACTOR, role: 'admin' } },
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('dryRun delegates', async () => {
    vi.mocked(model.dryRunEligibility).mockResolvedValueOnce({
      eligible: true,
      rules: [],
    })
    const res = await dryRunEligibilityController({
      body: undefined as unknown as void,
      ctx: { params: { id: CONTACT_ID }, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res.eligible).toBe(true)
  })
})
