import request from '@/utils/request'

export function getAdminUsersList(params) {
  return request({
    url: '/api/system/adminUsers/list',
    method: 'get',
    params
  })
}

export function getAdminUsers(id) {
  return request({
    url: `/api/system/adminUsers/${id}`,
    method: 'get'
  })
}

export function createAdminUsers(data) {
  return request({
    url: '/api/system/adminUsers',
    method: 'post',
    data
  })
}

export function updateAdminUsers(id, data) {
  return request({
    url: `/api/system/adminUsers/${id}`,
    method: 'put',
    data
  })
}

export function deleteAdminUsers(id) {
  return request({
    url: `/api/system/adminUsers/${id}`,
    method: 'delete'
  })
}
