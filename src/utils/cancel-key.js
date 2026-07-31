// =====================================================
// 取消 key 生成
// 用于 axios 重复请求自动取消,key 一致的请求会被前一个取消
// 包含 method + url + params,确保相同的查询会合并
// =====================================================

/**
 * 根据 axios config 生成唯一 key
 * @param {import('axios').AxiosRequestConfig} config
 * @returns {string}
 */
export function makeCancelKey(config) {
  return [
    (config.method || 'get').toLowerCase(),
    config.url,
    JSON.stringify(config.params || {})
  ].join('|')
}
