/**
 * 路由注册
 *
 * 路由总览:
 *   /              → MainLayout(主布局,需要登录)
 *     /dashboard   首页 Dashboard
 *     ...systemRoutes (从 modules/system.js 引入)
 *   /login        登录页(公开)
 *
 * 鉴权:由 router/permission.js 全局守卫处理(白名单 / 重定向 / 拉取用户信息)
 *
 * 加新模块路由:
 *   1. 在 src/router/modules/ 加新文件,export default [{ path, name, component, meta }]
 *   2. 在本文件 import + 展开到 children 里
 *   3. 如果是新模块(如 orders),可以建一个 modules/orders.js
 */

import { createRouter, createWebHistory } from 'vue-router'

import systemRoutes from './modules/system'

const routes = [
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/Dashboard.vue'),
        meta: { title: '首页' }
      },
      ...systemRoutes
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login/Login.vue'),
    meta: { title: '登录' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
