/**
 * 角色选中状态(Pinia)
 *
 * 跨页面共享:AdminRoles.vue 选角色后存,RoleMenu.vue 读出来加载分配
 * 不持久化(刷新页面就清空,符合用户预期)
 */

import { defineStore } from 'pinia'

export const useRoleSelectionStore = defineStore('roleSelection', {
  state: () => ({
    selectedRoleId: null
  }),
  actions: {
    setSelectedRoleId(id) {
      this.selectedRoleId = id
    },
    clearSelectedRoleId() {
      this.selectedRoleId = null
    }
  }
})
