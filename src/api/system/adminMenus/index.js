/**
 * 菜单管理 API
 *
 * 接口:
 *   GET    /api/system/adminMenus/list      列表分页(sort asc)
 *   GET    /api/system/adminMenus/all       所有菜单(sort DESC,角色分配用)
 *   GET    /api/system/adminMenus/options   parent_id=0 的菜单(上级下拉)
 *   GET    /api/system/adminMenus/:id       单条
 *   POST   /api/system/adminMenus           新增
 *   PUT    /api/system/adminMenus/:id       更新
 *   DELETE /api/system/adminMenus/:id       删除
 */

import request from '@/utils/request'

/**
 * 列表分页查询
 * @param {{page?: number, size?: number, status?: number}} params
 * @returns {Promise<{data: {list: Array, total, page, size}}>}
 */
export function getAdminMenusList(params) {
  return request({
    url: '/api/system/adminMenus/list',
    method: 'get',
    params
  })
}

/**
 * 上级菜单选项(parent_id = 0 的)
 * 用在"新增/编辑菜单"对话框里选上级
 * @returns {Promise<{data: Array<{id, name}>}>}
 */
export function getAdminMenusOptions() {
  return request({
    url: '/api/system/adminMenus/options',
    method: 'get'
  })
}

/**
 * 单条查询
 * @param {number} id
 * @returns {Promise<{data: Object}>}
 */
export function getAdminMenus(id) {
  return request({
    url: `/api/system/adminMenus/${id}`,
    method: 'get'
  })
}

/**
 * 新增
 * @param {{name, code, path, icon, parent_id, sort, status, buttons}} data
 * @returns {Promise<{data: Object}>}
 */
export function createAdminMenus(data) {
  return request({
    url: '/api/system/adminMenus',
    method: 'post',
    data
  })
}

/**
 * 更新(注意:空字符串/0 也会写入 DB,与 adminRoles 的"不更新"行为不一致)
 * @param {number} id
 * @param {{name, code, path, icon, parent_id, sort, status, buttons}} data
 * @returns {Promise<{data: Object}>}
 */
export function updateAdminMenus(id, data) {
  return request({
    url: `/api/system/adminMenus/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除
 * @param {number} id
 * @returns {Promise<{data: null}>}
 */
export function deleteAdminMenus(id) {
  return request({
    url: `/api/system/adminMenus/${id}`,
    method: 'delete'
  })
}

/**
 * 更新菜单按钮(预留,后端 handler 还没接)
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<{data: Object}>}
 */
export function updateMenuButtons(id, data) {
  return request({
    url: `/api/system/adminMenus/${id}/buttons`,
    method: 'put',
    data
  })
}
