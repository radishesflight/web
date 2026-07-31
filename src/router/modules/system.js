export default [
  {
    path: '/system/adminUsers',
    name: 'AdminUsers',
    component: () => import('@/views/system/adminUsers/AdminUsers.vue'),
    meta: { title: '管理员管理' }
  },
  {
    path: '/system/adminRoles',
    name: 'AdminRoles',
    component: () => import('@/views/system/adminRoles/AdminRoles.vue'),
    meta: { title: '角色管理' }
  },
  {
    path: '/system/adminMenus',
    name: 'AdminMenus',
    component: () => import('@/views/system/adminMenus/AdminMenus.vue'),
    meta: { title: '菜单管理' }
  },
  {
    path: '/system/roleMenu',
    name: 'RoleMenus',
    component: () => import('@/views/system/roleMenus/RoleMenus.vue'),
    meta: { title: '角色菜单权限' }
  }
]
