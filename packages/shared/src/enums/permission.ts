export const Permission = {
  NOT_REVIEWED: 'NOT_REVIEWED',
  ELIGIBLE: 'ELIGIBLE',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  BLOCKED: 'BLOCKED',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

export const PERMISSION_VALUES = Object.values(Permission)
