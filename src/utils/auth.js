/**
 * token 存取工具
 *
 * token 存 localStorage(刷新页面不丢)
 * key = "token"(单一字段,新版可以加"refresh_token"等)
 *
 * 用法:
 *   import { getToken, setToken, removeToken } from '@/utils/auth'
 *
 * 单元测试:src/utils/auth.test.js
 */

const TOKEN_KEY = 'token'

/**
 * 从 localStorage 读 token
 * @returns {string | null} token 字符串,没存则 null
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 写 token 到 localStorage
 * @param {string} token
 */
export function setToken(token) {
  return localStorage.setItem(TOKEN_KEY, token)
}

/**
 * 清 token(注销 / 鉴权失败时调)
 */
export function removeToken() {
  return localStorage.removeItem(TOKEN_KEY)
}
