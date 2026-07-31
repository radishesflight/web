/**
 * 菜单管理 API
 *
 * 接口(路径跟 menu.code 一致,中间件推断 adminMenus:*):
 *   GET    /api/system/adminMenus/list                    列表分页
 *   GET    /api/system/adminMenus/all                     所有菜单(带 operations,角色分配用)
 *   GET    /api/system/adminMenus/options                 parent_id=0 的菜单
 *   GET    /api/system/adminMenus/operations/:menu_id     某菜单的所有 operation
 *   GET    /api/system/adminMenus/:id                     单条
 *   POST   /api/system/adminMenus                         新增
 *   PUT    /api/system/adminMenus/:id                     更新
 *   DELETE /api/system/adminMenus/:id                     删除
 *
 *   GET    /api/system/adminMenus/operations/get/:id      operation 单条
 *   POST   /api/system/adminMenus/operations              operation 新增
 *   PUT    /api/system/adminMenus/operations/:id          operation 更新
 *   DELETE /api/system/adminMenus/operations/:id          operation 删除
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
 * 父级菜单下拉选项
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
 * 某菜单的所有 operation(动态,后端从 admin_menu_operations 表读)
 * @param {number} menuId
 * @returns {Promise<{data: Array<{id, menu_id, code, name, icon, sort}>}>}
 */
export function getMenuOperations(menuId) {
  return request({
    url: `/api/system/adminMenus/operations/${menuId}`,
    method: 'get'
  })
}

/**
 * 新增
 * @param {{name, code, path, icon, parent_id, sort, status, data_scope}} data
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
 * 更新
 * @param {number} id
 * @param {{name, code, path, icon, parent_id, sort, status, data_scope}} data
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

// =====================================================
// operation (admin_menu_operations) CRUD
// =====================================================
//
// 一条 operation = (method, path) 一条具体接口的权限元数据
// 用于"菜单管理 -> 操作"页面
// 启动时 SyncRoutes 会自动把 gin 里注册的路由同步进来,这里提供手动增删改

/**
 * operation 单条
 * @param {number} id
 * @returns {Promise<{data: {id, menu_id, method, path, name, sort}}>}
 */
export function getOperation(id) {
  return request({
    url: `/api/system/adminMenus/operations/get/${id}`,
    method: 'get'
  })
}

/**
 * 新增 operation
 * @param {{menu_id: number, method: string, path: string, name?: string, sort?: number}} data
 * @returns {Promise<{data: Object}>}
 */
export function createOperation(data) {
  return request({
    url: '/api/system/adminMenus/operations',
    method: 'post',
    data
  })
}

/**
 * 更新 operation(只改 name / sort / menu_id,method+path 不让改)
 * @param {number} id
 * @param {{menu_id?: number, name?: string, sort?: number}} data
 * @returns {Promise<{data: Object}>}
 */
export function updateOperation(id, data) {
  return request({
    url: `/api/system/adminMenus/operations/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除 operation(同时清掉 admin_role_operations 关联)
 * @param {number} id
 * @returns {Promise<{data: null}>}
 */
export function deleteOperation(id) {
  return request({
    url: `/api/system/adminMenus/operations/${id}`,
    method: 'delete'
  })
}
