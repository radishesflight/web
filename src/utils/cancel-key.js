/**
 * 取消 key 生成工具
 *
 * 用于 axios 重复请求自动取消(request.js 拦截器用)。
 * key 一致的请求会被前一个取消。
 *
 * key 组成:method + url + serializedParams
 *   GET /api/users?page=1 → "get|/api/users|{\"page\":1}"
 *   GET /api/users?page=2 → "get|/api/users|{\"page\":2}"  ← 不同 key
 *
 * 单元测试:src/utils/cancel-key.test.js
 */

/**
 * 根据 axios config 生成唯一 key
 *
 * @param {import('axios').AxiosRequestConfig} config axios 请求配置
 * @returns {string} 形如 "get|/api/users|{...}"
 */
export function makeCancelKey(config) {
  return [
    (config.method || 'get').toLowerCase(),
    config.url,
    JSON.stringify(config.params || {})
  ].join('|')
}
