/**
 * 用户状态管理(Pinia)
 *
 * 存储:
 *   token        - 当前 token(初始从 localStorage 读,刷新不丢)
 *   user         - 用户信息({id, username, email, phone, role, role_id})
 *   menus        - 菜单树(后端 LoginResp.menus)
 *   permissions  - 权限码列表(['adminUsers:view', 'adminUsers:add', ...])
 *
 * 典型用法:
 *   import { useUserStore } from '@/stores/user'
 *   const userStore = useUserStore()
 *   userStore.hasPermission('adminUsers:add')  // 按钮权限
 *   userStore.menus                            // 左侧菜单
 *   userStore.logout()                         // 注销
 *
 * 登录后通常一次性 setLoginData,见 views/Login/Login.vue
 */

import { defineStore } from 'pinia'
import { getToken, setToken as saveToken, removeToken } from '@/utils/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    user: null,
    menus: [],
    permissions: []
  }),

  getters: {
    /**
     * 判断当前用户是否有指定权限
     * @param {string} code 权限码,形如 "adminUsers:view"
     * @returns {boolean}
     */
    hasPermission: (state) => (code) => {
      return state.permissions.includes(code)
    },
    /** 当前菜单树 */
    getMenus: (state) => state.menus,
    /** 当前用户信息 */
    getUser: (state) => state.user,
    /** 是否已登录(token 非空) */
    isLoggedIn: (state) => !!state.token
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

    setUser(user) {
      this.user = user
    },

    setMenus(menus) {
      this.menus = menus
    },

    setPermissions(permissions) {
      this.permissions = permissions
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
    }
  }
})
