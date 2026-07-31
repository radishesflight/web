import request from '@/utils/request'

export function getRoleMenuList(params) {
  return request({
    url: '/api/system/adminRoles/list',
    method: 'get',
    params
  })
}

export function getMenusByRole(roleId) {
  return request({
    url: '/api/system/adminRoles/roleMenus',
    method: 'get',
    params: { role_id: roleId }
  })
}

export function getMenusByRoleWithNames(roleId) {
  return request({
    url: '/api/system/adminRoles/roleMenusWithNames',
    method: 'get',
    params: { role_id: roleId }
  })
}

export function assignMenusToRole(data) {
  return request({
    url: '/api/system/adminRoles/roleMenus',
    method: 'post',
    data
  })
}

export function getPermissionsByRole(roleId) {
  return request({
    url: '/api/system/adminRoles/rolePermissions',
    method: 'get',
    params: { role_id: roleId }
  })
}

export function getAllMenus() {
  return request({
    url: '/api/system/adminMenus/all',
    method: 'get'
  })
}

export function getMenuPermissions(menuId) {
  return request({
    url: '/api/system/menuPermissions',
    method: 'get',
    params: { menu_id: menuId }
  })
}
