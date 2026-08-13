/**
 * 权限判断工具
 *
 * 提供以下工具函数(底层都用 useUserStore):
 * - hasRoute(method, path):判断用户是否有某条 (method, path) 路由权限
 * - hasAnyRoute(routes):判断用户是否拥有任一 (method, path) 路由
 *
 * 用法(template):
 *   <el-button v-if="userStore.hasRoute('POST', '/api/system/adminUsers')">新增</el-button>
 *
 * 也可以在 <script setup> 里:
 *   import { hasRoute } from '@/utils/permission'
 *   if (hasRoute('DELETE', '/api/system/adminUsers/:id')) { ... }
 */

import { useUserStore } from '@/stores/user'

/**
 * 判断当前用户是否有指定路由权限
 * @param {string} method HTTP 方法(GET/POST/PUT/DELETE,大小写不敏感)
 * @param {string} path   完整路径(可带 :id 等通配)
 * @returns {boolean}
 */
export function hasRoute(method, path) {
  const userStore = useUserStore()
  return userStore.hasRoute(method, path)
}

/**
 * 判断当前用户是否有任一指定路由权限
 * @param {Array<{method: string, path: string}>} routes 路由列表
 * @returns {boolean} 任一满足即 true
 */
export function hasAnyRoute(routes) {
  const userStore = useUserStore()
  return routes.some(r => userStore.hasRoute(r.method, r.path))
}
