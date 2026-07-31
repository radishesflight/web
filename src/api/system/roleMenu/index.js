/**
 * 角色-菜单-路由 分配 API
 *
 * 接口(中间件按 (method, c.FullPath()) 直接匹配):
 *   GET  /api/system/roleMenu/allMenus            所有菜单(带 routes)
 *   GET  /api/system/roleMenu/roleMenus?role_id   某角色已分配的菜单 ID
 *   GET  /api/system/roleMenu/roleRoutes?role_id  某角色已分配的路由 ID
 *   PUT  /api/system/roleMenu/assign              分配 {role_id, menu_ids, route_ids}
 *
 * route 是 admin_menu_operations 表里的一行(method + path 一条具体接口)
 * 角色-路由关联存 admin_role_operations
 */

import request from '@/utils/request'

/**
 * 所有菜单(带 routes)
 * 给"分配菜单"对话框左侧 el-tree 用
 * @returns {Promise<{data: Array<{id, name, code, parent_id, operations: Array<{id, method, path, name}>}>}>}
 */
export function getAllMenus() {
  return request({
    url: '/api/system/roleMenu/allMenus',
    method: 'get'
  })
}

/**
 * 某角色已分配的菜单 ID
 * @param {number} roleId
 * @returns {Promise<{data: {menu_ids: number[]}}>}
 */
export function getRoleMenuIDs(roleId) {
  return request({
    url: '/api/system/roleMenu/roleMenus',
    method: 'get',
    params: { role_id: roleId }
  })
}

/**
 * 某角色已分配的路由 ID
 * @param {number} roleId
 * @returns {Promise<{data: {route_ids: number[]}}>}
 */
export function getRoleRouteIDs(roleId) {
  return request({
    url: '/api/system/roleMenu/roleRoutes',
    method: 'get',
    params: { role_id: roleId }
  })
}

/**
 * 分配菜单和路由
 * @param {{role_id: number, menu_ids: number[], route_ids: number[]}} data
 *   route_ids 是 admin_menu_operations.id 的列表
 * @returns {Promise<{data: null}>}
 */
export function assignMenusAndOperations(data) {
  return request({
    url: '/api/system/roleMenu/assign',
    method: 'put',
    data
  })
}
