import request from '@/utils/request'

// 上传图片
// axios 会自动检测 FormData 并设置 Content-Type: multipart/form-data; boundary=...
// 这里不需要显式设置 headers
export function uploadImage(formData) {
  return request({
    url: '/api/upload/image',
    method: 'post',
    data: formData
  })
}
