/**
 * 部门管理 API
 *
 * 接口(路径跟 menu.code "departments" 一致,中间件推断 departments:*):
 *   GET /api/system/departments  部门列表(扁平)
 */

import request from '@/utils/request'

/**
 * 部门列表
 * @returns {Promise<{data: Array<{id, name, parent_id, sort, status}>}>}
 */
export function getDepartments() {
  return request({
    url: '/api/system/departments',
    method: 'get'
  })
}
