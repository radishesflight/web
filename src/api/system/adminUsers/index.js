/**
 * 管理员(用户)管理 API
 *
 * 接口:
 *   GET    /api/system/adminUsers/list  列表分页
 *   GET    /api/system/adminUsers/:id   单条
 *   POST   /api/system/adminUsers       新增
 *   PUT    /api/system/adminUsers/:id   更新
 *   DELETE /api/system/adminUsers/:id   删除(软删除)
 */

import request from '@/utils/request'

/**
 * 列表分页查询
 * @param {{page?: number, size?: number, status?: number}} params
 * @returns {Promise<{data: {list: Array, total: number, page: number, size: number}}>}
 */
export function getAdminUsersList(params) {
  return request({
    url: '/api/system/adminUsers/list',
    method: 'get',
    params
  })
}

/**
 * 单条查询
 * @param {number} id 用户 ID
 * @returns {Promise<{data: Object}>}
 */
export function getAdminUsers(id) {
  return request({
    url: `/api/system/adminUsers/${id}`,
    method: 'get'
  })
}

/**
 * 新增
 * @param {{username, password, email, phone, status, role_id}} data
 * @returns {Promise<{data: Object}>}
 */
export function createAdminUsers(data) {
  return request({
    url: '/api/system/adminUsers',
    method: 'post',
    data
  })
}

/**
 * 更新
 * @param {number} id
 * @param {{email, phone, status, role_id}} data
 * @returns {Promise<{data: Object}>}
 */
export function updateAdminUsers(id, data) {
  return request({
    url: `/api/system/adminUsers/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除(软删除)
 * @param {number} id
 * @returns {Promise<{data: null}>}
 */
export function deleteAdminUsers(id) {
  return request({
    url: `/api/system/adminUsers/${id}`,
    method: 'delete'
  })
}
