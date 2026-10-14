/**
 * 用户状态管理(Pinia)
 *
 * 存储:
 *   token        - 当前 token(初始从 localStorage 读,刷新不丢)
 *   user         - 用户信息({id, username, email, phone, role, role_id})
 *   menus        - 菜单树(后端 LoginResp.menus)
 *   permissions  - 路由权限列表(['GET /api/system/adminUsers/list', 'POST /api/system/adminUsers', ...])
 *                  每项 = "METHOD /path",跟后端 admin_menu_operations 表对应
 *
 * 典型用法:
 *   import { useUserStore } from '@/stores/user'
 *   const userStore = useUserStore()
 *   userStore.hasRoute('POST', '/api/system/adminUsers')  // 新增按钮权限
 *   userStore.menus                                       // 左侧菜单
 *   userStore.logout()                                    // 注销
 *
 * 登录后通常一次性 setLoginData,见 views/Login/Login.vue
 */

import { defineStore } from 'pinia'
import { getToken, setToken as saveToken, removeToken } from '@/utils/auth'
import { getCurrentUser } from '@/api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    user: null,
    menus: [],
    permissions: []
  }),

  getters: {
    /**
     * 判断当前用户是否有某条路由权限
     * @param {string} method HTTP 方法(GET/POST/PUT/DELETE,大小写不敏感)
     * @param {string} path   完整路径(可带 :id 等通配)
     * @returns {boolean}
     */
    hasRoute: (state) => (method, path) => {
      if (!method || !path) return false
      const key = method.toUpperCase() + ' ' + path
      return state.permissions.includes(key)
    }
  },

  actions: {
    /**
     * 单独设置 token(写 localStorage + 内存)
     * 一般不用,登录用 setLoginData 一次性设置
     */
    setToken(token) {
      this.token = token
      saveToken(token)
    },

    /**
     * 一次性设置登录后的所有数据
     * 由 views/Login/Login.vue 调
     * @param {{token, user, menus, permissions}} payload
     */
    setLoginData({ token, user, menus, permissions }) {
      this.token = token
      this.user = user
      this.menus = menus || []
      this.permissions = permissions || []
      saveToken(token)
    },

    /**
     * 清空所有状态 + 删 localStorage token
     * 由 views/Login/NavBar.vue 调
     */
    logout() {
      this.token = ''
      this.user = null
      this.menus = []
      this.permissions = []
      removeToken()
    },

    /**
     * 静默从后端拉最新的 user / menus / permissions,覆盖本地状态
     *
     * 用途:解决"管理员改了角色权限,前端按钮还显示"的脏缓存问题
     *  - 后端 /api/user/info 走 service.GetCurrentUser,会按 roleID 重查 DB
     *  - 配合 main.js 的 focus / visibilitychange 监听自动触发
     *
     * 失败:静默,只 console.warn(避免循环弹 ElMessage)
     */
    async refreshUserInfo() {
      if (!this.token) return
      try {
        const res = await getCurrentUser()
        const { user, menus, permissions } = res.data || {}
        if (user) this.user = user
        this.menus = menus || []
        this.permissions = permissions || []
      } catch (e) {
        // 静默:request.js 已经弹过错误了,这里不重复
        console.warn('[userStore] refreshUserInfo failed:', e?.message || e)
      }
    }
  }
})
