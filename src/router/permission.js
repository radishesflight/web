/**
 * 路由鉴权守卫
 *
 * 流程:
 *  1. 有 token:
 *     - 跳 /login → 跳 / (避免登录态访问登录页)
 *     - 跳其他 → 检查 store 是否有用户信息
 *       - 没有 → 调 getCurrentUser 填充 store
 *       - 有 → 放行
 *  2. 没 token:
 *     - 白名单路径(/login)→ 放行
 *     - 其他 → 跳 /login?redirect=<原路径>
 *
 * 这个守卫**不会**强制清 token,token 失效由 axios 拦截器处理(走业务码 1002/1003)
 */

import router from './index'
import { getToken } from '@/utils/auth'
import { useUserStore } from '@/stores/user'
import { getCurrentUser } from '@/api/auth'

// 不需要登录就能访问的路径
const whiteList = ['/login']

router.beforeEach(async (to, from, next) => {
  const hasToken = getToken()
  const userStore = useUserStore()

  if (hasToken) {
    // 1. 已登录访问 /login,跳首页
    if (to.path === '/login') {
      next({ path: '/' })
      return
    }

    // 2. store 没用户信息(刷新页面后 store 是空的),从后端拉一次
    if (!userStore.menus || userStore.menus.length === 0) {
      try {
        const res = await getCurrentUser()
        userStore.setLoginData({
          token: hasToken,
          user: res.data.user,
          menus: res.data.menus || [],
          permissions: res.data.permissions || []
        })
      } catch (e) {
        // 拉失败(比如 token 已失效),axios 拦截器会跳 login
        console.error('获取用户信息失败', e)
      }
    }
    next()
  } else {
    // 3. 没 token
    if (whiteList.indexOf(to.path) !== -1) {
      // 白名单放行
      next()
    } else {
      // 跳 login + 记录 redirect
      next(`/login?redirect=${to.path}`)
    }
  }
})
