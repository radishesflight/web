/**
 * 服务器部署(serverDeploy)模块 API
 *
 * 接口(2026-10-17 改造:从实时拉阿里云 → 查本地 DB 持久化):
 *   GET    /api/serverDeploy/images?region=&type=&keyword=&page=&size=  列镜像(本地 DB,毫秒级)
 *   POST   /api/serverDeploy/images/sync                                    触发同步(12s 左右)
 *   GET    /api/serverDeploy/images/sync/status                             同步状态(轮询)
 *   GET    /api/serverDeploy/regions                                       已同步的 region 字典(本地 DB)
 *
 * 注:跨地域复制/共享/撤销实时接口(POST /imageList/copy、POST/DELETE /imageList/share)
 *   在 2026-10-17 DB 化重构中未接通,前端按钮已下线,等需要时再加回。
 *
 * 字段约定(后端 GORM 用 snake_case):
 *   image_id / image_name / image_type(Self|Others) / image_owner_alias
 *   region_id / os_name / architecture / size_gb / status / description / snapshot_at
 */
import request from '@/utils/request'

// 列镜像(本地 DB)
export function listImages(params) {
  return request({ url: '/api/serverDeploy/images', method: 'get', params })
}

// 触发同步(删旧 + 拉阿里云 + 插新,实测 ~12s;并发 33 region,可放宽到 60s)
// 注:全局 axios 默认 timeout=10000(request.js),同步必须显式覆盖,否则会超时弹错
export function syncImages() {
  return request({ url: '/api/serverDeploy/images/sync', method: 'post', timeout: 60000 })
}

// 同步状态
export function getSyncStatus() {
  return request({ url: '/api/serverDeploy/images/sync/status', method: 'get' })
}

// 已同步的 region 字典
export function listRegions() {
  return request({ url: '/api/serverDeploy/regions', method: 'get' })
}
