/**
 * 角色-菜单 / 角色-权限 API
 *
 * 接口:
 *   GET  /api/system/adminRoles/roleMenus            查某角色的菜单 ID 列表
 *   GET  /api/system/adminRoles/roleMenusWithNames   查菜单名(中文逗号拼接)
 *   GET  /api/system/adminRoles/rolePermissions      查某角色的权限码列表
 *   POST /api/system/adminRoles/roleMenus            提交分配(删除老的 + 写新的)
 *   GET  /api/system/adminMenus/all                  所有菜单(用于分配对话框的树)
 *   GET  /api/system/menuPermissions                 查某菜单的权限(预留)
 */

import request from '@/utils/request'

/**
 * 角色列表(用于"角色菜单权限"页的主表格)
 * @param {{page?: number, size?: number, status?: number}} params
 * @returns {Promise<{data: {list: Array, total, page, size}}>}
 */
export function getRoleMenuList(params) {
  return request({
    url: '/api/system/adminRoles/list',
    method: 'get',
    params
  })
}

/**
 * 查某角色已分配的菜单 ID 列表
 * @param {number} roleId
 * @returns {Promise<{data: {menu_ids: number[]}}>}
 */
export function getMenusByRole(roleId) {
  return request({
    url: '/api/system/adminRoles/roleMenus',
    method: 'get',
    params: { role_id: roleId }
  })
}

/**
 * 查某角色已分配的菜单名(中文逗号拼接的字符串)
 * @param {number} roleId
 * @returns {Promise<{data: {menu_ids: number[], menu_names: string}}>}
 */
export function getMenusByRoleWithNames(roleId) {
  return request({
    url: '/api/system/adminRoles/roleMenusWithNames',
    method: 'get',
    params: { role_id: roleId }
  })
}

/**
 * 给某角色分配菜单 + 权限
 * 后端会自动补充 <menu_code>:view 权限 + 异步刷新使用该角色的用户 token
 * @param {{role_id, menu_ids, permissions}} data
 * @returns {Promise<{data: null}>}
 */
export function assignMenusToRole(data) {
  return request({
    url: '/api/system/adminRoles/roleMenus',
    method: 'put',
    data
  })
}

/**
 * 查某角色的权限码列表
 * @param {number} roleId
 * @returns {Promise<{data: {permissions: string[]}}>}
 */
export function getPermissionsByRole(roleId) {
  return request({
    url: '/api/system/adminRoles/rolePermissions',
    method: 'get',
    params: { role_id: roleId }
  })
}

/**
 * 所有菜单(用于"分配菜单"对话框左侧的 el-tree)
 * 路由在 adminRoles 下,因为业务属于"角色菜单权限"功能,推断为 roleMenu:view
 * @returns {Promise<{data: Array}>} 扁平 list,前端用 buildMenuTree 构树
 */
export function getAllMenus() {
  return request({
    url: '/api/system/adminRoles/allMenus',
    method: 'get'
  })
}

/**
 * 查某菜单的权限(预留,后端路由没启用)
 * @param {number} menuId
 * @returns {Promise<{data: Object}>}
 */
export function getMenuPermissions(menuId) {
  return request({
    url: '/api/system/menuPermissions',
    method: 'get',
    params: { menu_id: menuId }
  })
}
