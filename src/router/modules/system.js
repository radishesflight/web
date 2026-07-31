/**
 * 系统管理路由模块
 *
 * 新设计:角色管理 + 角色菜单权限 融合成单页面 /system/roleMenu
 *   - 左侧:角色列表 + CRUD
 *   - 右侧:选中角色后,分配菜单和操作权限
 *
 * 包含:
 *   /system/adminUsers   管理员管理(独立)
 *   /system/adminMenus   菜单管理(独立)
 *   /system/adminRoles   角色管理(独立,角色 CRUD,菜单分配在 roleMenu 页)
 *   /system/departments  部门管理(独立,给"看部门"用)
 *   /system/roleMenu     分配菜单和操作权限(独立)
 *
 * 加新页面的步骤:
 *   1. 在 src/views/system/<sub>/ 加 .vue
 *   2. 在本文件加 { path, name, component, meta }
 */
export default [
  {
    path: '/system/adminUsers',
    name: 'AdminUsers',
    component: () => import('@/views/system/adminUsers/AdminUsers.vue'),
    meta: { title: '管理员管理' }
  },
  {
    path: '/system/adminMenus',
    name: 'AdminMenus',
    component: () => import('@/views/system/adminMenus/AdminMenus.vue'),
    meta: { title: '菜单管理' }
  },
  {
    path: '/system/adminRoles',
    name: 'AdminRoles',
    component: () => import('@/views/system/adminRoles/AdminRoles.vue'),
    meta: { title: '角色管理' }
  },
  {
    path: '/system/departments',
    name: 'Departments',
    component: () => import('@/views/system/departments/Departments.vue'),
    meta: { title: '部门管理' }
  },
  {
    path: '/system/roleMenu',
    name: 'RoleMenu',
    component: () => import('@/views/system/roleMenu/RoleMenu.vue'),
    meta: { title: '权限分配' }
  }
]
