import request from '@/utils/request'

export function getAdminRolesList(params) {
  return request({
    url: '/api/system/adminRoles/list',
    method: 'get',
    params
  })
}

export function getAdminRoles(id) {
  return request({
    url: `/api/system/adminRoles/${id}`,
    method: 'get'
  })
}

export function createAdminRoles(data) {
  return request({
    url: '/api/system/adminRoles',
    method: 'post',
    data
  })
}

export function updateAdminRoles(id, data) {
  return request({
    url: `/api/system/adminRoles/${id}`,
    method: 'put',
    data
  })
}

export function deleteAdminRoles(id) {
  return request({
    url: `/api/system/adminRoles/${id}`,
    method: 'delete'
  })
}
