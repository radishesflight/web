/**
 * 管理员(用户)管理 API
 *
 * 接口:
 *   GET    /api/system/adminUsers/list  列表分页
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

/**
 * 个人中心 - 当前用户改自己(2026-10-19 新增)
 *
 * 挂在 AuthMiddleware 下,不走 PermissionMiddleware
 * 所有登录用户都能调。id 从 token 拿,前端不传,防越权。
 *
 * @param {{email?: string, phone?: string, new_password?: string, old_password: string}} data
 *   - email / phone / new_password: 都可选,空字符串 = 不改
 *   - old_password: 必填(任何修改都要求当前密码二次确认)
 * @returns {Promise<{data: Object}>} 返回更新后的用户信息
 */
export function updateMyProfile(data) {
  return request({
    url: '/api/system/adminUsers/me',
    method: 'put',
    data
  })
}
