/**
 * codeDeploy 模块路由
 *
 * 包含:
 *   /codeDeploy/online         代码拉取控制台(假数据,后续对接后端)
 *   /codeDeploy/apkPackage     apk/前端包管理
 *   /codeDeploy/businessProjects 业务项目(资产)管理 - 列表/CRUD/同步 JMS
 *
 * 加新页面的步骤:
 *   1. 在 src/views/codeDeploy/<sub>/ 加 .vue
 *   2. 在本文件加 { path, name, component, meta }
 *   3. 在 admin_menus 表加一条 code/path 记录
 *   4. 重启后端,SyncRoutes 自动同步 (method, path) 到 admin_menu_operations
 */
export default [
  {
    path: '/codeDeploy/online',
    name: 'Online',
    component: () => import('@/views/codeDeploy/online/Online.vue'),
    meta: { title: '代码部署' },
  },
  {
    path: '/codeDeploy/apkPackage',
    name: 'ApkPackage',
    component: () => import('@/views/codeDeploy/apkPackage/ApkPackage.vue'),
    meta: { title: 'apk/前端包管理' },
  },
  {
    path: '/codeDeploy/businessProjects',
    name: 'BusinessProjects',
    component: () => import('@/views/codeDeploy/businessProjects/BusinessProjects.vue'),
    meta: { title: '资产列表' },
  },
]
