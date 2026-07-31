/**
 * 文件上传 API
 *
 * 接口:
 *   POST /api/upload/image 上传图片到阿里云 OSS
 */

import request from '@/utils/request'

/**
 * 上传图片
 *
 * @param {FormData} formData 必须包含 "file" 字段
 * @returns {Promise<{data: {url: string}}>} url 是 OSS CDN 地址
 *
 * 注意事项:
 *   - axios 会自动检测 FormData 并设置 Content-Type: multipart/form-data; boundary=...
 *   - 这里不需要显式设置 headers
 *   - 后端只接受 .jpg .jpeg .png .gif .webp,最大 5MB
 */
export function uploadImage(formData) {
  return request({
    url: '/api/upload/image',
    method: 'post',
    data: formData
  })
}
