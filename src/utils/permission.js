/**
 * 权限判断工具
 *
 * 提供两个工具函数(实际底层都用 useUserStore)
 * - hasPermission(code):单个权限判断
 * - hasAnyPermission(codes):多个权限任一满足
 *
 * 用法(template):
 *   <el-button v-if="userStore.hasPermission('adminUsers:add')">新增</el-button>
 *
 * 也可以在 <script setup> 里:
 *   import { hasPermission } from '@/utils/permission'
 *   if (hasPermission('adminUsers:delete')) { ... }
 */

import { useUserStore } from '@/stores/user'

/**
 * 判断当前用户是否有指定权限
 * @param {string} code 权限码,形如 "adminUsers:view"
 * @returns {boolean}
 */
export function hasPermission(code) {
  const userStore = useUserStore()
  return userStore.hasPermission(code)
}

/**
 * 判断当前用户是否有任一权限
 * @param {string[]} codes 权限码列表
 * @returns {boolean} 任一满足即 true
 */
export function hasAnyPermission(codes) {
  const userStore = useUserStore()
  return codes.some(code => userStore.permissions.includes(code))
}
