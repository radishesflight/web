/**
 * 启动入口
 *
 * 启动顺序:
 *  1. 全局 CSS(main.css 包含 base.css)
 *  2. 创建 Vue 应用
 *  3. 安装 Pinia(状态管理)
 *  4. 安装 Vue Router + 鉴权守卫(router/permission.js)
 *  5. 安装 Element Plus(全局 UI 库)
 *  6. 全局注册所有 Element Plus 图标(供 <component :is="iconName"> 使用)
 *  7. 挂载到 #app
 *
 * 全局组件的 icon 引用方式:
 *   <component :is="row.icon" />   row.icon 是 Element Plus 图标名
 *
 * 注意:不要在这里加业务逻辑,业务代码在 views/ 里
 */

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
// 引入鉴权守卫(只是 import,beforeEach 注册在 router 创建时已完成)
import './router/permission'
import { useUserStore } from '@/stores/user'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// 全局注册所有 Element Plus 图标(几百个,内存可忽略)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// =====================================================
// 全局 focus / visibilitychange 监听:自动刷新用户权限
// =====================================================
// 解决"后台改了角色权限,前端按钮还显示"的脏缓存问题
// - 切回 tab / 窗口获焦 时,30s 节流地调一次 userStore.refreshUserInfo()
// - 后端 /api/user/info 会按 roleID 重查 DB 拿到最新 menus/permissions
const userStore = useUserStore()
let lastPermRefreshAt = 0
const PERM_REFRESH_THROTTLE_MS = 30_000

const onFocusOrVisible = () => {
  if (!userStore.token) return
  const now = Date.now()
  if (now - lastPermRefreshAt < PERM_REFRESH_THROTTLE_MS) return
  lastPermRefreshAt = now
  userStore.refreshUserInfo()
}

window.addEventListener('focus', onFocusOrVisible)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onFocusOrVisible()
})

app.mount('#app')
