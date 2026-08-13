/**
 * 代码部署(codeDeploy)模块 API
 *
 * 接口:
 *   GET    /api/codeDeploy/endpoints                  端字典(下拉用)
 *   GET    /api/codeDeploy/projects/tree              整棵树(项目 + 端)
 *   GET    /api/codeDeploy/packages?project_id=&endpoint_id=  代码包列表
 *   POST   /api/codeDeploy/packages                   上传 (multipart/form-data)
 *   POST   /api/codeDeploy/packages/:id/pull          触发部署(目前 mock)
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

// =====================================================
// 代码包
// =====================================================

/**
 * 列代码包(按 project_id + endpoint_id 过滤)
 * @param {{project_id?: number, endpoint_id?: number}} params
 * @returns {Promise<{data: {list: Array<{id, project_id, endpoint_id, name, version, full_name, ext, size, file_url, uploader_id, build_time, note, status, created_at}>}}>}
 */
export function getPackages(params) {
  return request({
    url: '/api/codeDeploy/packages',
    method: 'get',
    params
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
export function uploadPackage(formData) {
  return request({
    url: '/api/codeDeploy/packages',
    method: 'post',
    data: formData
  })
}

/**
 * 触发部署
 * @param {number} id
 * @returns {Promise<{data: {success, time_cost?, material?, err?, full_name}}>}
 */
export function pullPackage(id) {
  return request({
    url: `/api/codeDeploy/packages/${id}/pull`,
    method: 'post'
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
