/**
 * 服务器部署(serverDeploy)模块 API
 *
 * 接口(2026-10-17 改造:从实时拉阿里云 → 查本地 DB 持久化):
 *   GET    /api/serverDeploy/images?region=&type=&keyword=&page=&size=  列镜像(本地 DB,毫秒级)
 *   POST   /api/serverDeploy/images/sync                                    触发同步(12s 左右)
 *   GET    /api/serverDeploy/images/sync/status                             同步状态(轮询)
 *   GET    /api/serverDeploy/regions                                       已同步的 region 字典(本地 DB)
 *
 * 操作用接口(实时调阿里云):
 *   POST   /api/serverDeploy/imageList/copy             跨地域复制
 *   POST   /api/serverDeploy/imageList/share            共享
 *   DELETE /api/serverDeploy/imageList/share            撤销共享
 *   GET    /api/serverDeploy/imageList/share/:region/:imageId  查已共享
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

// 跨地域复制(2026-10-17 保留)
export function copyImage(data) {
  return request({ url: '/api/serverDeploy/imageList/copy', method: 'post', data })
}

// 共享
export function shareImage(data) {
  return request({ url: '/api/serverDeploy/imageList/share', method: 'post', data })
}

// 撤销共享
export function unshareImage(data) {
  return request({ url: '/api/serverDeploy/imageList/share', method: 'delete', data })
}

// 查已共享
export function listSharedAccounts(region, imageId) {
  return request({
    url: `/api/serverDeploy/imageList/share/${encodeURIComponent(region)}/${encodeURIComponent(imageId)}`,
    method: 'get'
  })
}
