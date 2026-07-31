import request from '@/utils/request'

export function getAdminMenusList(params) {
  return request({
    url: '/api/system/adminMenus/list',
    method: 'get',
    params
  })
}

export function getAdminMenusOptions() {
  return request({
    url: '/api/system/adminMenus/options',
    method: 'get'
  })
}

export function getAdminMenus(id) {
  return request({
    url: `/api/system/adminMenus/${id}`,
    method: 'get'
  })
}

export function createAdminMenus(data) {
  return request({
    url: '/api/system/adminMenus',
    method: 'post',
    data
  })
}

export function updateAdminMenus(id, data) {
  return request({
    url: `/api/system/adminMenus/${id}`,
    method: 'put',
    data
  })
}

export function deleteAdminMenus(id) {
  return request({
    url: `/api/system/adminMenus/${id}`,
    method: 'delete'
  })
}

export function updateMenuButtons(id, data) {
  return request({
    url: `/api/system/adminMenus/${id}/buttons`,
    method: 'put',
    data
  })
}
