import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, removeToken } from './auth'
import router from '@/router'
import { BizCode, isAuthFail } from '@/constants/bizcode'
import { makeCancelKey } from './cancel-key'

// =====================================================
// axios 实例
// =====================================================
// baseURL 从环境变量读:
//   - dev:    /api(vite proxy 转发到 :8080)
//   - prod:   /api(nginx 同域转发)或 https://api.example.com(跨域)
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 10000
})

// =====================================================
// 重复请求自动取消
// 策略:仅对 GET 生效(GET 幂等,取消安全)
//   - 业务方没传 signal 时,自动用 url+method+params 作 key 去重
//   - 业务方传了 signal,使用业务方的(可绑组件 unmount)
//   - POST/PUT/DELETE 默认不自动取消,业务方主动传才生效
// =====================================================
const pendingGetRequests = new Map()

service.interceptors.request.use(
  config => {
    const token = getToken()
    if (token) {
      config.headers['Authorization'] = token
    }

    // 自动取消:仅对 GET,且业务方没传 signal
    if (!config.signal && (config.method || 'get').toLowerCase() === 'get') {
      const key = makeCancelKey(config)
      if (pendingGetRequests.has(key)) {
        // 取消上一个相同请求
        pendingGetRequests.get(key).abort('自动取消重复请求')
      }
      const controller = new AbortController()
      config.signal = controller.signal
      config._cancelKey = key
      pendingGetRequests.set(key, controller)
    }

    return config
  },
  error => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    // 清理 GET 取消记录
    const key = response.config?._cancelKey
    if (key) pendingGetRequests.delete(key)

    const res = response.data

    if (res.code === BizCode.Success) {
      return res
    }

    // 鉴权失败:清 token 跳 login(避免在 login 页死循环)
    if (isAuthFail(res.code)) {
      ElMessage.error(res.msg || '登录已过期,请重新登录')
      removeToken()
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
      return Promise.reject(new Error(res.msg || '登录已过期'))
    }

    // 通用业务错误
    ElMessage.error(res.msg || '请求失败')
    return Promise.reject(new Error(res.msg || '请求失败'))
  },
  error => {
    // 清理 GET 取消记录
    const key = error.config?._cancelKey
    if (key) pendingGetRequests.delete(key)

    // 主动取消的请求(axios.isCancel)不弹错误
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    // HTTP 层错误(网络 500/超时等)
    if (error.response && error.response.status === 401) {
      ElMessage.error('登录已过期,请重新登录')
      removeToken()
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
    } else {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default service
