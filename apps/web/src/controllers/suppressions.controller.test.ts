import type { Suppression } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addSuppressionController,
  listSuppressionsController,
  removeSuppressionController,
} from './suppressions.controller'

vi.mock('@/models/suppressions.model', () => ({
  addSuppression: vi.fn(),
  listSuppressions: vi.fn(),
  removeSuppression: vi.fn(),
}))

const model = await import('@/models/suppressions.model')

const ACTOR = '55555555-5555-5555-5555-555555555555'
const FAKE_SUPP: Suppression = {
  id: '66666666-6666-6666-6666-666666666666',
  email: 'x@y.com',
  reason: 'MANUAL',
  notes: null,
  suppressedAt: new Date(),
  suppressedBy: ACTOR,
}

describe('suppressions.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('add delegates with actor', async () => {
    vi.mocked(model.addSuppression).mockResolvedValueOnce(FAKE_SUPP)
    const res = await addSuppressionController({
      body: { email: 'x@y.com', reason: 'MANUAL' },
      ctx: { params: {}, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res).toBe(FAKE_SUPP)
    expect(model.addSuppression).toHaveBeenCalledWith(
      { email: 'x@y.com', reason: 'MANUAL' },
      ACTOR,
    )
  })

  it('add throws when auth missing', async () => {
    await expect(
      addSuppressionController({
        body: { email: 'x@y.com', reason: 'MANUAL' },
        ctx: { params: {} },
      }),
    ).rejects.toThrow(/Auth required/)
  })

  it('list delegates without needing actor', async () => {
    vi.mocked(model.listSuppressions).mockResolvedValueOnce([FAKE_SUPP])
    const res = await listSuppressionsController({
      body: { limit: 10 },
      ctx: { params: {}, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res).toEqual([FAKE_SUPP])
    expect(model.listSuppressions).toHaveBeenCalledWith({ limit: 10 })
  })

  it('remove delegates and returns ok', async () => {
    vi.mocked(model.removeSuppression).mockResolvedValueOnce(undefined)
    const res = await removeSuppressionController({
      body: undefined as unknown as void,
      ctx: { params: { id: FAKE_SUPP.id }, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res).toEqual({ ok: true })
    expect(model.removeSuppression).toHaveBeenCalledWith(FAKE_SUPP.id, ACTOR)
  })
})
