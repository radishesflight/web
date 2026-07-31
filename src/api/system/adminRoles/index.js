/**
 * 角色管理 API
 *
 * 接口(路径跟 menu.code 一致,中间件推断 adminRoles:*):
 *   GET    /api/system/adminRoles/list  列表分页
 *   GET    /api/system/adminRoles/:id   单条
 *   POST   /api/system/adminRoles       新增(带 dataScope)
 *   PUT    /api/system/adminRoles/:id   更新(带 dataScope)
 *   DELETE /api/system/adminRoles/:id   删除
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
 * 单条查询
 * @param {number} id
 * @returns {Promise<{data: Object}>}
 */
export function getAdminRoles(id) {
  return request({
    url: `/api/system/adminRoles/${id}`,
    method: 'get'
  })
}

/**
 * 新增
 * @param {{name, describe, status, data_scope}} data
 *   data_scope: 0=全部 1=部门 2=自己
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
 * @param {{name, describe, status, data_scope}} data
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
