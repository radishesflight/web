/**
 * 认证相关 API
 *
 * 接口:
 *   POST /api/login       登录(返回 token + user + menus + permissions)
 *   POST /api/logout      注销(删 Redis token)
 *   GET  /api/user/info   当前用户(重新查用户/菜单/权限)
 */

import request from '@/utils/request'

/**
 * 登录
 * @param {{username: string, password: string}} data
 * @returns {Promise<{data: {token, user, menus, permissions}}>}
 */
export function login(data) {
  return request({
    url: '/api/login',
    method: 'post',
    data
  })
}

/**
 * 注销
 * @returns {Promise<{data: null}>}
 */
export function logout() {
  return request({
    url: '/api/logout',
    method: 'post'
  })
}

/**
 * 当前用户信息
 * @returns {Promise<{data: {user, menus, permissions}}>}
 */
export function getCurrentUser() {
  return request({
    url: '/api/user/info',
    method: 'get'
  })
}
