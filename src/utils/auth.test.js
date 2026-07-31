import { describe, it, expect, beforeEach } from 'vitest'
import { getToken, setToken, removeToken } from '@/utils/auth'

describe('auth 工具', () => {
  beforeEach(() => {
    // 每个测试前清空 token
    localStorage.removeItem('token')
  })

  it('setToken 后 getToken 能拿到', () => {
    setToken('test-token-123')
    expect(getToken()).toBe('test-token-123')
  })

  it('removeToken 后 getToken 返回 null', () => {
    setToken('test-token-456')
    removeToken()
    expect(getToken()).toBeNull()
  })

  it('没设置过 token 时 getToken 返回 null', () => {
    expect(getToken()).toBeNull()
  })
})
