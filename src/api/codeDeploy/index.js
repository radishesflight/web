/**
 * 代码部署(codeDeploy)模块 API
 *
 * 接口:
 *   GET    /api/codeDeploy/endpoints                  端字典(下拉用)
 *   GET    /api/codeDeploy/projects/tree              整棵树(项目 + 端)
 *   GET    /api/codeDeploy/projects                   项目列表
 *   GET    /api/codeDeploy/projects/:id               单个项目
 *   POST   /api/codeDeploy/projects                   新建
 *   PUT    /api/codeDeploy/projects/:id               更新
 *   DELETE /api/codeDeploy/projects/:id               删除
 *   GET    /api/codeDeploy/packages?project_id=&endpoint_id=  代码包列表
 *   GET    /api/codeDeploy/packages/:id               单个代码包
 *   GET    /api/codeDeploy/packages/:id/download-url  OSS 签名下载 URL
 *   POST   /api/codeDeploy/packages                   上传 (multipart/form-data)
 *   POST   /api/codeDeploy/packages/:id/pull          触发部署(目前 mock)
 *   DELETE /api/codeDeploy/packages/:id               删除代码包
 *
 * 字段约定:
 *   - 后端时间格式: "2006-01-02 15:04:05" (字符串)
 *   - 业务项目 code 机器名 + name 展示名(如 code='b2b', name='b2b电商项目')
 *   - 端 ext='apk' 或 'zip',决定文件后缀
 *   - 代码包 name 是前端填的原始名,version + full_name 是后端生成
 */

import request from '@/utils/request'

// =====================================================
// 端字典
// =====================================================

/**
 * 查所有启用的端
 * @returns {Promise<{data: {list: Array<{id, code, name, ext, icon, sort, status}>}}>}
 */
export function getEndpoints() {
  return request({
    url: '/api/codeDeploy/endpoints',
    method: 'get'
  })
}

// =====================================================
// 业务项目
// =====================================================

/**
 * 查整棵树(项目 + 项目下的端)
 * @returns {Promise<{data: {list: Array<{id, code, name, description, sort, status, endpoints: Array}>}}>}
 */
export function getProjectTree() {
  return request({
    url: '/api/codeDeploy/projects/tree',
    method: 'get'
  })
}

/**
 * 查项目列表(无端)
 * @returns {Promise<{data: {list: Array}}>}
 */
export function getProjects() {
  return request({
    url: '/api/codeDeploy/projects',
    method: 'get'
  })
}

/**
 * 单个项目 + 端列表
 * @param {number} id
 */
export function getProject(id) {
  return request({
    url: `/api/codeDeploy/projects/${id}`,
    method: 'get'
  })
}

/**
 * 新建业务项目
 * @param {{code, name, description?, sort?, status?, endpoint_ids: number[]}} data
 */
export function createProject(data) {
  return request({
    url: '/api/codeDeploy/projects',
    method: 'post',
    data
  })
}

/**
 * 更新业务项目(全量替换端列表)
 * @param {number} id
 * @param {{code, name, description?, sort?, status?, endpoint_ids: number[]}} data
 */
export function updateProject(id, data) {
  return request({
    url: `/api/codeDeploy/projects/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除业务项目
 * @param {number} id
 */
export function deleteProject(id) {
  return request({
    url: `/api/codeDeploy/projects/${id}`,
    method: 'delete'
  })
}

// =====================================================
// 代码包
// =====================================================

/**
 * 列代码包(按 project_id + asset_id + asset_path_id 过滤)
 * 2026-10-16 改造:用 asset_id/asset_path_id 替代 endpoint_id
 * @param {{project_id?: number, asset_id?: number, asset_path_id?: number}} params
 * @returns {Promise<{data: {list: Array<{id, project_id, asset_id, asset_path_id, name, version, full_name, ext, size, file_url, uploader_id, build_time, note, status, created_at}>}}>}
 */
export function getPackages(params) {
  return request({
    url: '/api/codeDeploy/packages',
    method: 'get',
    params
  })
}

/**
 * 单个代码包
 * @param {number} id
 */
export function getPackage(id) {
  return request({
    url: `/api/codeDeploy/packages/${id}`,
    method: 'get'
  })
}

/**
 * 上传代码包
 * @param {FormData} formData 必含字段:
 *   - file           必填,apk/zip
 *   - project_id     必填
 *   - endpoint_id    必填
 *   - name           必填,原始名(不含版本号/扩展名)
 *   - build_time     可选,默认当前
 *   - note           可选
 * @returns {Promise<{data: {id, full_name, file_url, version, ...}}>}
 */
// 上传 5 分钟超时(300MB 文件:浏览器读取 + multipart + 后端推 OSS 几条链路串起来,远不止 10s)
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000

export function uploadPackage(formData) {
  return request({
    url: '/api/codeDeploy/packages',
    method: 'post',
    data: formData,
    timeout: UPLOAD_TIMEOUT_MS
  })
}

/**
 * 触发部署(JMS 跑 cd+curl+unzip,后端内部轮询直到终态)
 * 5 分钟超时:100MB 包下载 + 解压需要时间
 * @param {number} id 代码包 id
 * @returns {Promise<{data: {success, package_id, full_name, asset_id, asset_name, deploy_path, jms_id, command, is_finished, is_success, status, time_cost, material?, summary?, err?}}>}
 */
export function pullPackage(id) {
  return request({
    url: `/api/codeDeploy/packages/${id}/pull`,
    method: 'post',
    timeout: 5 * 60 * 1000
  })
}

/**
 * 后端 API 部署(走 git reset,不是 OSS 包)
 * 5 分钟超时:git fetch + reset + composer install 一次完成
 * **branch 不传**:服务端自己在服务器上跑 git symbolic-ref --short HEAD 拿当前分支
 * @param {number} assetId 业务资产 id
 * @param {number} pathId 部署路径 id(必传,后端校验 type=api 且 asset_id 匹配)
 * @returns {Promise<{data: {success, asset_id, asset_name, path_id, path_name, deploy_path, branch, jms_output, summary?, time_cost, err?}}>}
 */
export function gitDeploy(assetId, pathId) {
  return request({
    url: `/api/codeDeploy/assets/${assetId}/git-deploy`,
    method: 'post',
    data: { path_id: pathId },
    timeout: 5 * 60 * 1000
  })
}

/**
 * 同步业务项目(从 JumpServer 拉节点树,增量 upsert)
 * POST /api/codeDeploy/projects/sync
 * @returns {Promise<{data: {added, updated, removed, total_jms, total_local}}>}
 */
export function syncProjects() {
  return request({
    url: '/api/codeDeploy/projects/sync',
    method: 'post'
  })
}

/**
 * 同步业务资产(从 JumpServer 拉资产列表,按 nodes[0] 关联到项目)
 * POST /api/codeDeploy/assets/sync
 * @returns {Promise<{data: {added, updated, removed, total_jms, total_local}}>}
 */
export function syncAssets() {
  return request({
    url: '/api/codeDeploy/assets/sync',
    method: 'post'
  })
}

/**
 * 一键同步:项目 + 资产(顺序执行,前端一个按钮)
 * POST /api/codeDeploy/sync
 * @returns {Promise<{data: {projects, assets, project_err?, asset_err?}}>}
 */
export function syncAll() {
  return request({
    url: '/api/codeDeploy/sync',
    method: 'post'
  })
}

/**
 * 查所有启用的业务资产(代码拉取控制台"选择资产"列表)
 * GET /api/codeDeploy/assets
 * @returns {Promise<{data: {list: Array<{id, project_id, jms_id, name, address, platform, os, protocol, port, comment, status, created_at, updated_at}>}}>}
 */
export function getAssets() {
  return request({
    url: '/api/codeDeploy/assets',
    method: 'get'
  })
}

/**
 * 查项目 + 资产 + 路径 三层嵌套(给"前端包管理"页左侧树用)
 * GET /api/codeDeploy/projects-with-paths
 * @returns {Promise<{data: {list: Array<{id, code, name, description, sort, status, path_count, assets: Array<{id, name, address, platform, os, paths: Array<{id, name}>}>}>}}>}
 */
export function getProjectsWithPaths() {
  return request({
    url: '/api/codeDeploy/projects-with-paths',
    method: 'get'
  })
}

/**
 * 查某项目下的所有资产
 * GET /api/codeDeploy/projects/:id/assets
 * @param {number} projectId
 * @returns {Promise<{data: {list: Array}}>}
 */
export function getProjectAssets(projectId) {
  return request({
    url: `/api/codeDeploy/projects/${projectId}/assets`,
    method: 'get'
  })
}

/**
 * 查某资产下所有路径
 * GET /api/codeDeploy/assets/:id/paths
 */
export function getAssetPaths(assetId, type) {
  return request({
    url: `/api/codeDeploy/assets/${assetId}/paths`,
    method: 'get',
    params: type ? { type: type } : {}
  })
}

/**
 * 给资产加一条路径
 * POST /api/codeDeploy/assets/:id/paths
 * @param {number} assetId
 * @param {{name: string, path: string, sort?: number}} data
 */
export function addAssetPath(assetId, data) {
  return request({
    url: `/api/codeDeploy/assets/${assetId}/paths`,
    method: 'post',
    data
  })
}

/**
 * 删一条路径
 * DELETE /api/codeDeploy/assets/paths/:id
 */
export function deleteAssetPath(pathId) {
  return request({
    url: `/api/codeDeploy/assets/paths/${pathId}`,
    method: 'delete'
  })
}

/**
 * 获取下载链接(后端返回 OSS 签名 URL,1小时有效,带 Content-Disposition: attachment)
 * @param {number} id
 * @returns {Promise<{data: string}>}
 */
export function getPackageDownloadURL(id) {
  return request({
    url: `/api/codeDeploy/packages/${id}/download-url`,
    method: 'get'
  })
}

// =====================================================
// 部署日志(2026-10-16 新增)
//   - list:  分页 + 多维筛选
//   - detail: 单条详情(含 JMS 远端输出 stderr 末 2000 字符)
// =====================================================

/**
 * 列操作日志
 * @param {{
 *   event?: string,    // 事件类型
 *   result?: number,   // 1=成功 0=失败
 *   keyword?: string,  // 包名/用户名 LIKE 模糊匹配
 *   start?: string,    // ISO 时间 '2026-10-01' 或 RFC3339
 *   end?: string,      // 同 start
 *   page?: number,
 *   size?: number
 * }} params
 */
export function getOperationLogs(params) {
  return request({
    url: '/api/codeDeploy/operation-logs',
    method: 'get',
    params
  })
}

/** 单条日志详情 */
export function getOperationLog(id) {
  return request({
    url: `/api/codeDeploy/operation-logs/${id}`,
    method: 'get'
  })
}

/**
 * 删除代码包(软删 DB + 删 OSS)
 * @param {number} id
 */
export function deletePackage(id) {
  return request({
    url: `/api/codeDeploy/packages/${id}`,
    method: 'delete'
  })
}
