import { describe, expect, it } from 'vitest'
import {
  CONTACT_STATUS_TRANSITIONS,
  CONSENT_STATUS_TRANSITIONS,
  PERMISSION_TRANSITIONS,
  canTransition,
} from './state-transitions'

describe('state transitions', () => {
  it('contact: DISCOVERED → REVIEW_REQUIRED allowed', () => {
    expect(canTransition(CONTACT_STATUS_TRANSITIONS, 'DISCOVERED', 'REVIEW_REQUIRED')).toBe(true)
  })

  it('contact: SUPPRESSED is terminal', () => {
    expect(canTransition(CONTACT_STATUS_TRANSITIONS, 'SUPPRESSED', 'REVIEWED')).toBe(false)
  })

  it('consent: cannot re-request after WITHDRAWN', () => {
    expect(canTransition(CONSENT_STATUS_TRANSITIONS, 'WITHDRAWN', 'REQUESTED')).toBe(false)
  })

  it('consent: CONFIRMED can only go to WITHDRAWN', () => {
    expect(canTransition(CONSENT_STATUS_TRANSITIONS, 'CONFIRMED', 'WITHDRAWN')).toBe(true)
    expect(canTransition(CONSENT_STATUS_TRANSITIONS, 'CONFIRMED', 'REQUESTED')).toBe(false)
  })

  it('permission: BLOCKED is terminal', () => {
    expect(canTransition(PERMISSION_TRANSITIONS, 'BLOCKED', 'ELIGIBLE')).toBe(false)
  })
})
