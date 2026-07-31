/**
 * 权限判断工具
 *
 * 提供三个工具函数(底层都用 useUserStore):
 * - hasPermission(code):单个权限码判断
 * - hasAnyPermission(codes):多个权限码任一满足
 * - hasDataScope(scope):数据范围判断(0=全部/1=部门/2=自己)
 *
 * 用法(template):
 *   <el-button v-if="userStore.hasPermission('adminUsers:add')">新增</el-button>
 *   <span v-if="userStore.hasDataScope(1)">部门数据</span>
 *
 * 也可以在 <script setup> 里:
 *   import { hasPermission, hasDataScope } from '@/utils/permission'
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

/**
 * 判断当前用户数据范围是否"覆盖"指定 scope
 * 0=全部 / 1=部门 / 2=自己
 * 数字越小权限越大
 * @param {number} requiredScope 需要的最低范围
 * @returns {boolean}
 */
export function hasDataScope(requiredScope) {
  const userStore = useUserStore()
  return userStore.hasDataScope(requiredScope)
}
