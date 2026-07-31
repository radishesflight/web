import router from './index'
import { getToken } from '@/utils/auth'
import { useUserStore } from '@/stores/user'
import { getCurrentUser } from '@/api/auth'

const whiteList = ['/login']

router.beforeEach(async (to, from, next) => {
  const hasToken = getToken()
  const userStore = useUserStore()

  if (hasToken) {
    if (to.path === '/login') {
      next({ path: '/' })
    } else {
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
          console.error('获取用户信息失败', e)
        }
      }
      next()
    }
  } else {
    if (whiteList.indexOf(to.path) !== -1) {
      next()
    } else {
      next(`/login?redirect=${to.path}`)
    }
  }
})
