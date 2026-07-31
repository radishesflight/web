/**
 * 系统管理路由模块
 *
 * 包含用户 / 角色 / 菜单 / 角色-菜单 四个子模块
 * 都被 MainLayout 包住(需要登录)
 *
 * 加新页面(在 system 模块下):
 *   1. 在 src/views/system/<sub>/ 加 .vue
 *   2. 在本文件加 { path, name, component, meta }
 *
 * 完整加新模块(比如 orders)见 DEVELOPING.md 第 3 节
 */
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
