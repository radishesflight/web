/**
 * 角色-菜单-操作 分配 API
 *
 * 接口(路径跟 menu.code "roleMenu" 一致,中间件推断 roleMenu:*):
 *   GET  /api/system/roleMenu/allMenus                所有菜单(带 operations)
 *   GET  /api/system/roleMenu/roleMenus?role_id       某角色已分配的菜单 ID
 *   GET  /api/system/roleMenu/roleOperations?role_id  某角色已分配的操作(按 menu_id 分组)
 *   POST /api/system/roleMenu/assign                  分配 {role_id, menu_ids, operations}
 *
 * 注意:这是新融合单页面的核心 API,替代旧的 adminRoles/roleMenus/*
 */

import request from '@/utils/request'

/**
 * 所有菜单(带 operations)
 * 给"分配菜单"对话框左侧 el-tree 用
 * @returns {Promise<{data: Array<{id, name, code, parent_id, operations: Array<{id, code, name}>}>}>}
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
 * 某角色已分配的操作(按 menu_id 分组)
 * 返回 {operations: { menu_id: [operation_code, ...] }}
 * @param {number} roleId
 * @returns {Promise<{data: {operations: Object<number, string[]>}}>}
 */
export function getRoleOperationCodes(roleId) {
  return request({
    url: '/api/system/roleMenu/roleOperations',
    method: 'get',
    params: { role_id: roleId }
  })
}

/**
 * 分配菜单和操作
 * @param {{role_id, menu_ids: number[], operations: Object<number, string[]>}} data
 *   operations 的 key 是 menu_id(数字),value 是 operation_code 数组
 *   例: { 10: ['view', 'add'], 11: ['view', 'edit'] }
 * @returns {Promise<{data: null}>}
 */
export function assignMenusAndOperations(data) {
  return request({
    url: '/api/system/roleMenu/assign',
    method: 'post',
    data
  })
}
