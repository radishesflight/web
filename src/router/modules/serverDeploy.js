/**
 * serverDeploy 模块路由
 *
 * 包含:
 *   /serverDeploy/imageList       镜像列表(阿里云 ECS 自定义镜像管理)
 *   /serverDeploy/cloudCredential 云平台凭证管理(2026-10-17 新增,菜单 code=credentials)
 *
 * 加新页面的步骤:
 *   1. 在 src/views/serverDeploy/<sub>/ 加 .vue
 *   2. 在本文件加 { path, name, component, meta }
 *   3. 在 admin_menus 表加一条 code/path 记录
 *   4. 重启后端,SyncRoutes 自动同步 (method, path) 到 admin_menu_operations
 */
export default [
  {
    path: '/serverDeploy/imageList',
    name: 'ImageList',
    component: () => import('@/views/serverDeploy/imageList/ImageList.vue'),
    meta: { title: '镜像列表' }
  },
  {
    path: '/serverDeploy/cloudCredential',
    name: 'CloudCredential',
    component: () => import('@/views/serverDeploy/cloudCredential/CloudCredential.vue'),
    meta: { title: '云平台凭证' }
  }
]
