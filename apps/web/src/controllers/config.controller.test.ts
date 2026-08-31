import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AppConfig } from '@prisma/client'
import { getConfigController, updateConfigController } from './config.controller'
import { ValidationError } from '@/middleware/with-controller'
import { InvalidConfigError } from '@/models/config.model'

vi.mock('@/models/config.model', () => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  InvalidConfigError: class InvalidConfigError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'InvalidConfigError'
    }
  },
}))

const configModel = await import('@/models/config.model')

const FAKE_CONFIG: AppConfig = {
  id: 1,
  sendingEnabled: false,
  campaignEnabled: false,
  dailySendLimit: 0,
  hourlySendLimit: 0,
  minIntervalSeconds: 60,
  consentRequestCooldownDays: 90,
  updatedAt: new Date(),
  updatedBy: null,
}

const ACTOR = '22222222-2222-2222-2222-222222222222'

describe('config.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getConfigController delegates to the model', async () => {
    vi.mocked(configModel.getConfig).mockResolvedValueOnce(FAKE_CONFIG)
    const res = await getConfigController({ body: undefined as unknown as void, ctx: { params: {} } })
    expect(res).toBe(FAKE_CONFIG)
    expect(configModel.getConfig).toHaveBeenCalledOnce()
  })

  it('updateConfigController passes actor and body', async () => {
    vi.mocked(configModel.updateConfig).mockResolvedValueOnce(FAKE_CONFIG)
    const res = await updateConfigController({
      body: { dailySendLimit: 5 },
      ctx: { params: {}, auth: { userId: ACTOR, role: 'admin' } },
    })
    expect(res).toBe(FAKE_CONFIG)
    expect(configModel.updateConfig).toHaveBeenCalledWith({ dailySendLimit: 5 }, ACTOR)
  })

  it('updateConfigController wraps InvalidConfigError as ValidationError', async () => {
    vi.mocked(configModel.updateConfig).mockRejectedValueOnce(
      new configModel.InvalidConfigError('bad'),
    )
    await expect(
      updateConfigController({
        body: { sendingEnabled: true },
        ctx: { params: {}, auth: { userId: ACTOR, role: 'admin' } },
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('updateConfigController throws if auth missing (misconfigured route)', async () => {
    await expect(
      updateConfigController({ body: {}, ctx: { params: {} } }),
    ).rejects.toThrow(/requires auth/)
  })
})
