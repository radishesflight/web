/**
 * 角色管理 API
 *
 * 接口(路径跟 menu.code 一致,中间件推断 adminRoles:*):
 *   GET    /api/system/adminRoles/list       列表分页(需 Permission)
 *   GET    /api/system/adminRoles/options    角色下拉(只需 Auth,不需 Permission)
 *   POST   /api/system/adminRoles            新增
 *   PUT    /api/system/adminRoles/:id        更新
 *   DELETE /api/system/adminRoles/:id        删除
 */

import request from '@/utils/request'

/**
 * 列表分页查询
 * @param {{page?: number, size?: number, status?: number}} params
 * @returns {Promise<{data: {list: Array, total, page, size}}>}
 */
export function getAdminRolesList(params) {
  return request({
    url: '/api/system/adminRoles/list',
    method: 'get',
    params
  })
}

/**
 * 角色下拉选项(只需 Auth,所有登录用户可调)
 *
 * 用途:"管理员管理"等页面的"角色"列下拉/显示。
 * 后端走 AuthMiddleware 不走 PermissionMiddleware,
 * 不需要 caller 有 adminRoles 权限。
 *
 * @returns {Promise<{data: Array<{id: number, name: string}>}>}
 */
export function getRoleOptions() {
  return request({
    url: '/api/system/adminRoles/options',
    method: 'get'
  })
}

/**
 * 新增
 * @param {{name, describe, status}} data
 * @returns {Promise<{data: Object}>}
 */
export function createAdminRoles(data) {
  return request({
    url: '/api/system/adminRoles',
    method: 'post',
    data
  })
}

/**
 * 更新
 * @param {number} id
 * @param {{name, describe, status}} data
 * @returns {Promise<{data: Object}>}
 */
export function updateAdminRoles(id, data) {
  return request({
    url: `/api/system/adminRoles/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除
 * @param {number} id
 * @returns {Promise<{data: null}>}
 */
export function deleteAdminRoles(id) {
  return request({
    url: `/api/system/adminRoles/${id}`,
    method: 'delete'
  })
}
