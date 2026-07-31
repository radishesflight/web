/**
 * axios 封装
 *
 * 这是整个前端的 HTTP 统一出口,所有后端调用都走这个 service。
 *
 * 自动处理:
 *  1. baseURL 从环境变量读(dev 走 vite proxy,prod 看 .env.production)
 *  2. Authorization Header 从 localStorage 读 token
 *  3. 业务码判断:
 *     - code === 0   → resolve(res)
 *     - code 鉴权失败(1002/1003) → 清 token + 跳 /login + reject
 *     - code 其他业务错误 → 弹 ElMessage + reject
 *  4. GET 重复请求自动取消(防止狂点 / 组件卸载时回调污染)
 *  5. HTTP 层错误(网络 500/超时)→ 弹 ElMessage
 *  6. axios.isCancel 的请求静默 reject(不弹错)
 *
 * view 里直接 `await`:
 *   const res = await getAdminUsersList({ page: 1 })
 *   res.data 已经是后端 data 部分({ list, total, page, size })
 *
 * 加新业务码的处理:见 src/constants/bizcode.js
 */

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
//   - dev:    /api(vite proxy 转发到 :8080,vite.config.js 配 proxy)
//   - prod:   /api(nginx 同域转发)或 https://api.example.com(跨域)
const service = axios.create({
  // url 写完整路径(/api/...),不走 baseURL 拼接
  // dev: 走 vite proxy(proxy 配置在 vite.config.js)
  // prod: 走 nginx 反代或直接打后端域名
  baseURL: '',
  timeout: 10000
})

// =====================================================
// 重复请求自动取消(仅对 GET 生效)
// =====================================================
// Map<key, AbortController>
// key = method + url + serializedParams(由 makeCancelKey 生成)
const pendingGetRequests = new Map()

service.interceptors.request.use(
  config => {
    // 1. 注入 Authorization
    const token = getToken()
    if (token) {
      config.headers['Authorization'] = token
    }

    // 2. 自动取消(仅 GET,且业务方没传 signal)
    //    POST/PUT/DELETE 业务方主动传 signal 才生效(防数据状态错乱)
    if (!config.signal && (config.method || 'get').toLowerCase() === 'get') {
      const key = makeCancelKey(config)
      if (pendingGetRequests.has(key)) {
        // 取消上一个相同请求
        pendingGetRequests.get(key).abort('自动取消重复请求')
      }
      const controller = new AbortController()
      config.signal = controller.signal
      // _cancelKey 写到 config,响应拦截器清理时用
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
  // ============== 成功响应(HTTP 200) ==============
  response => {
    // 清理 GET 取消记录
    const key = response.config?._cancelKey
    if (key) pendingGetRequests.delete(key)

    const res = response.data

    // 业务码 0 = 成功,直接返回 res(view 拿 res.data)
    if (res.code === BizCode.Success) {
      return res
    }

    // 业务码鉴权失败(1002/1003):清 token + 跳 login
    if (isAuthFail(res.code)) {
      ElMessage.error(res.msg || '登录已过期,请重新登录')
      removeToken()
      // 避免在 login 页死循环
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
      return Promise.reject(new Error(res.msg || '登录已过期'))
    }

    // 其他业务错误:弹 toast + reject(让 view 拿 catch 处理)
    ElMessage.error(res.msg || '请求失败')
    return Promise.reject(new Error(res.msg || '请求失败'))
  },

  // ============== HTTP 层错误(网络/超时) ==============
  error => {
    // 清理 GET 取消记录
    const key = error.config?._cancelKey
    if (key) pendingGetRequests.delete(key)

    // 主动取消的请求(axios.isCancel)不弹错,静默 reject
    // (用户狂点分页时,被取消的请求不应该是错误)
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    // HTTP 401(以防后端某天改回 HTTP 401 鉴权)
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
