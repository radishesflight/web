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
    hasPermission: (state) => (code) => {
      return state.permissions.includes(code)
    },
    getMenus: (state) => state.menus,
    getUser: (state) => state.user,
    isLoggedIn: (state) => !!state.token
  },

  actions: {
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

    setLoginData({ token, user, menus, permissions }) {
      this.token = token
      this.user = user
      this.menus = menus || []
      this.permissions = permissions || []
      saveToken(token)
    },

    logout() {
      this.token = ''
      this.user = null
      this.menus = []
      this.permissions = []
      removeToken()
    }
  }
})
