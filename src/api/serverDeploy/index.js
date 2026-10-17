/**
 * 服务器部署(serverDeploy)模块 API
 *
 * 镜像管理(2026-10-17 改造:从实时拉阿里云 → 查本地 DB 持久化):
 *   GET    /api/serverDeploy/images?region=&type=&keyword=&page=&size=  列镜像(本地 DB,毫秒级)
 *   POST   /api/serverDeploy/images/sync                                    触发同步(12s 左右)
 *   GET    /api/serverDeploy/images/sync/status                             同步状态(轮询)
 *   GET    /api/serverDeploy/regions                                       已同步的 region 字典(本地 DB)
 *
 * 云平台凭证管理(2026-10-17 新增):
 *   GET    /api/serverDeploy/credentials?type=&keyword=                  列表(secret_key 已 mask)
 *   GET    /api/serverDeploy/credentials/:id                              详情(secret_key 明文)
 *   POST   /api/serverDeploy/credentials                                  新增
 *   PUT    /api/serverDeploy/credentials/:id                              编辑
 *   DELETE /api/serverDeploy/credentials/:id                              删除(软删)
 *
 * 字段约定(后端 GORM 用 snake_case):
 *   - 镜像:image_id / image_name / image_type(Self|Others) / image_owner_alias
 *     region_id / os_name / architecture / size_gb / status / description / snapshot_at / image_created_at
 *   - 凭证:id / name / type(aliyun|tencent) / access_key / secret_key(masked|plain) / remark
 */
import request from '@/utils/request'

// ========== 镜像 ==========

// 列镜像(本地 DB)
export function listImages(params) {
  return request({ url: '/api/serverDeploy/images', method: 'get', params })
}

// 触发同步(删旧 + 拉阿里云 + 插新,实测 ~12s;并发 33 region,可放宽到 60s)
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

// ========== 云平台凭证(2026-10-17 新增) ==========

export function listCredentials(params) {
  return request({ url: '/api/serverDeploy/credentials', method: 'get', params })
}

export function getCredential(id) {
  return request({ url: `/api/serverDeploy/credentials/${id}`, method: 'get' })
}

export function createCredential(data) {
  return request({ url: '/api/serverDeploy/credentials', method: 'post', data })
}

export function updateCredential(id, data) {
  return request({ url: `/api/serverDeploy/credentials/${id}`, method: 'put', data })
}

export function deleteCredential(id) {
  return request({ url: `/api/serverDeploy/credentials/${id}`, method: 'delete' })
}

// ========== 云服务器列表(2026-10-17 新增) ==========
//   GET    /api/serverDeploy/servers?credential_id=&vendor=&region=&keyword=&page=&size=
//   POST   /api/serverDeploy/servers/sync?credential_id=
//   GET    /api/serverDeploy/servers/sync/status

export function listServers(params) {
  return request({ url: '/api/serverDeploy/servers', method: 'get', params })
}

// 同步全部 aliyun 凭证(credential_id 缺省)
export function syncServers(credentialId) {
  const params = credentialId ? { credential_id: credentialId } : {}
  return request({ url: '/api/serverDeploy/servers/sync', method: 'post', params, timeout: 120000 })
}

export function getServerSyncStatus() {
  return request({ url: '/api/serverDeploy/servers/sync/status', method: 'get' })
}
