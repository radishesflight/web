import { describe, it, expect } from 'vitest'
import { BizCode, isAuthFail } from '@/constants/bizcode'

describe('BizCode', () => {
  it('Success 应该是 0', () => {
    expect(BizCode.Success).toBe(0)
  })

  it('所有业务码应该是 number', () => {
    for (const [key, value] of Object.entries(BizCode)) {
      expect(typeof value, `${key} 应该是 number`).toBe('number')
    }
  })

  it('BizCode 应该是 immutable(冻结)', () => {
    expect(Object.isFrozen(BizCode)).toBe(true)
  })
})

describe('isAuthFail', () => {
  it('TokenInvalid (1002) 应该是鉴权失败', () => {
    expect(isAuthFail(BizCode.TokenInvalid)).toBe(true)
  })

  it('TokenMissing (1003) 应该是鉴权失败', () => {
    expect(isAuthFail(BizCode.TokenMissing)).toBe(true)
  })

  it('Success (0) 不是鉴权失败', () => {
    expect(isAuthFail(BizCode.Success)).toBe(false)
  })

  it('UserNotFound (1004) 不是鉴权失败', () => {
    expect(isAuthFail(BizCode.UserNotFound)).toBe(false)
  })

  it('NoPermission (2001) 不是鉴权失败', () => {
    expect(isAuthFail(BizCode.NoPermission)).toBe(false)
  })

  it('ParamsInvalid (4001) 不是鉴权失败', () => {
    expect(isAuthFail(BizCode.ParamsInvalid)).toBe(false)
  })

  it('Unknown (9999) 不是鉴权失败', () => {
    expect(isAuthFail(BizCode.Unknown)).toBe(false)
  })
})
