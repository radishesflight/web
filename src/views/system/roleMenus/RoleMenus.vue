<!--
  角色菜单权限分配页

  功能:
   - 角色列表(主表格)
   - 点"分配菜单"打开对话框:
     - 左侧 el-tree 选菜单(父子联动:选父全选子、选子自动选父)
     - 右侧按选中的菜单显示"操作权限"checkbox
       (查看/新增/编辑/删除/详情)
   - 提交后自动刷新当前用户的菜单/权限缓存

  关键点:
   - 5 个 operation 是 hard-coded(view/add/edit/delete/detail)
   - 提交格式:{ role_id, menu_ids, permissions: ['adminUsers:add', ...] }
   - 后端会自动给每个 menu 补 <code>:view 权限
   - 提交成功后调 getCurrentUser 刷新本地 store(避免重新登录)

  注意:
   - 顶级菜单(parent_id=0)只展示"无需配置权限"
   - 子菜单才有 5 个操作权限 checkbox
-->
<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { getRoleMenuList, getMenusByRole, getMenusByRoleWithNames, assignMenusToRole, getAllMenus, getPermissionsByRole } from '@/api/system/roleMenu'
import { getCurrentUser } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const roleLoading = ref(false)
const roleList = ref([])
const pagination = ref({ page: 1, size: 10, total: 0 })
const menuNamesCache = ref({})

const menuDialogVisible = ref(false)
const allMenus = ref([])
const menuLoading = ref(false)
const selectedRoleId = ref(null)
const selectedMenuIds = ref([])
const menuPermissionsMap = ref({}) // { menuId: ['view', 'add', 'edit', ...] }
const menuTreeRef = ref(null)
let setCheckedKeysTimer = null
const userStore = useUserStore()

// 固定的5个操作权限
const operationTypes = [
  { label: '查看', value: 'view' },
  { label: '新增', value: 'add' },
  { label: '编辑', value: 'edit' },
  { label: '删除', value: 'delete' },
  { label: '详情', value: 'detail' }
]

const fetchRoles = async () => {
  roleLoading.value = true
  try {
    const res = await getRoleMenuList({ page: pagination.value.page, size: pagination.value.size })
    roleList.value = res.data.list
    pagination.value.total = res.data.total

    for (const role of roleList.value) {
      try {
        const menuRes = await getMenusByRoleWithNames(role.id)
        menuNamesCache.value[role.id] = menuRes.data.menu_names || ''
      } catch {
        menuNamesCache.value[role.id] = ''
      }
    }
  } catch (error) {
    console.error('获取角色列表失败:', error)
  } finally {
    roleLoading.value = false
  }
}

const fetchAllMenus = async () => {
  menuLoading.value = true
  try {
    const res = await getAllMenus()
    allMenus.value = buildMenuTree(res.data)
  } catch (error) {
    console.error('获取菜单列表失败:', error)
  } finally {
    menuLoading.value = false
  }
}

const buildMenuTree = (menus) => {
  const map = {}
  const roots = []

  menus.forEach(menu => {
    map[menu.id] = { ...menu, children: [] }
  })

  menus.forEach(menu => {
    if (menu.parent_id === 0) {
      roots.push(map[menu.id])
    } else if (map[menu.parent_id]) {
      map[menu.parent_id].children.push(map[menu.id])
    }
  })

  return roots
}

const findMenuById = (menus, id) => {
  for (const menu of menus) {
    if (menu.id === id) return menu
    if (menu.children) {
      const found = findMenuById(menu.children, id)
      if (found) return found
    }
  }
  return null
}

// 选中菜单按左侧树形结构顺序排列
const sortedSelectedMenuIds = computed(() => {
  // 递归扁平化树形菜单（按树的前序遍历顺序）
  const flattenMenu = (menus) => {
    const result = []
    for (const menu of menus) {
      result.push(menu.id)
      if (menu.children && menu.children.length > 0) {
        result.push(...flattenMenu(menu.children))
      }
    }
    return result
  }
  const treeOrder = flattenMenu(allMenus.value)
  // 只保留选中的ID，保持树形顺序
  return treeOrder.filter(id => selectedMenuIds.value.includes(id))
})

const handleMenuCheck = (data, checkedObj) => {
  // 用 check-strictly 关闭 element-plus 默认的"半选"联动
  // 自己维护双向级联:选父→全选子,选子→勾父(不是半选,是真勾)
  const isChecked = checkedObj.checkedKeys.includes(data.id)
  const checkedSet = new Set(checkedObj.checkedKeys)

  if (isChecked) {
    // 向下级联:选父节点 → 全选所有子节点(递归)
    if (data.children && data.children.length > 0) {
      const collectAllIds = (nodes) => {
        nodes.forEach(n => {
          checkedSet.add(n.id)
          if (n.children && n.children.length > 0) {
            collectAllIds(n.children)
          }
        })
      }
      collectAllIds(data.children)
    }

    // 向上级联:选子节点 → 勾选所有父节点(向上递归)
    let parentId = data.parent_id
    while (parentId && parentId !== 0) {
      checkedSet.add(parentId)
      const parent = findMenuById(allMenus.value, parentId)
      parentId = parent ? parent.parent_id : 0
    }
  } else {
    // 取消:如果取消的是父节点 → 同时取消所有子节点
    if (data.children && data.children.length > 0) {
      const removeAllIds = (nodes) => {
        nodes.forEach(n => {
          checkedSet.delete(n.id)
          if (n.children && n.children.length > 0) {
            removeAllIds(n.children)
          }
        })
      }
      removeAllIds(data.children)
    }

    // 取消:如果子节点都取消完了 → 父也取消(向上递归)
    const tryRemoveParents = (childMenuId) => {
      const menu = findMenuById(allMenus.value, childMenuId)
      if (!menu || !menu.parent_id) return
      const parent = findMenuById(allMenus.value, menu.parent_id)
      if (!parent) return
      const siblings = parent.children || []
      const hasSelectedSibling = siblings.some(s =>
        s.id !== childMenuId && checkedSet.has(s.id)
      )
      if (!hasSelectedSibling) {
        checkedSet.delete(parent.id)
        tryRemoveParents(parent.id)
      }
    }
    if (data.parent_id) {
      tryRemoveParents(data.id)
    }
  }

  selectedMenuIds.value = [...checkedSet]

  // 同步到 el-tree UI(强制 setCheckedKeys,父节点是"勾选"不是 element-plus 默认的"半选")
  nextTick(() => {
    if (menuTreeRef.value) {
      menuTreeRef.value.setCheckedKeys([...checkedSet], false)
    }
  })

  // 初始化新选中菜单的权限,只对非顶级菜单,且该菜单之前没权限记录
  checkedSet.forEach(menuId => {
    if (!menuPermissionsMap.value[menuId]) {
      const menu = findMenuById(allMenus.value, menuId)
      if (menu && menu.parent_id !== 0) {
        menuPermissionsMap.value[menuId] = operationTypes.map(op => op.value)
      }
    }
  })
}

const toggleMenuPermission = (menuId, opValue, checked) => {
  if (!menuPermissionsMap.value[menuId]) {
    menuPermissionsMap.value[menuId] = []
  }
  if (checked) {
    if (!menuPermissionsMap.value[menuId].includes(opValue)) {
      menuPermissionsMap.value[menuId].push(opValue)
    }
  } else {
    menuPermissionsMap.value[menuId] = menuPermissionsMap.value[menuId].filter(v => v !== opValue)
  }
}

const isPermissionChecked = (menuId, opValue) => {
  return menuPermissionsMap.value[menuId]?.includes(opValue) || false
}

const handleMenuAuthSubmit = async () => {
  try {
    const allPermissions = []
    selectedMenuIds.value.forEach(menuId => {
      const menu = findMenuById(allMenus.value, menuId)
      if (menu && menuPermissionsMap.value[menuId]) {
        const menuCode = menu.code || 'menu'
        menuPermissionsMap.value[menuId].forEach(op => {
          allPermissions.push(menuCode + ':' + op)
        })
      }
    })

    await assignMenusToRole({
      role_id: selectedRoleId.value,
      menu_ids: selectedMenuIds.value,
      permissions: allPermissions
    })

    ElMessage.success('分配成功')

    // 刷新用户权限
    const res = await getCurrentUser()
    userStore.setLoginData({
      token: userStore.token,
      user: res.data.user,
      menus: res.data.menus || [],
      permissions: res.data.permissions || []
    })

    menuDialogVisible.value = false
    fetchRoles()
  } catch (error) {
    console.error('分配菜单失败:', error)
  }
}

const handleMenuAuth = async (row) => {
  selectedRoleId.value = row.id
  await fetchAllMenus()

  try {
    const res = await getMenusByRole(row.id)
    selectedMenuIds.value = res.data.menu_ids || []
  } catch (error) {
    console.error('获取角色菜单失败:', error)
    selectedMenuIds.value = []
  }

  // 获取该角色已有的权限
  try {
    const permRes = await getPermissionsByRole(row.id)
    const savedPermissions = permRes.data.permissions || []

    // 解析权限码，初始化菜单权限
    menuPermissionsMap.value = {}
    savedPermissions.forEach(perm => {
      const parts = perm.split(':')
      if (parts.length === 2) {
        const menuCode = parts[0]
        const op = parts[1]
        // 找到对应的菜单ID
        const menu = findMenuByCode(allMenus.value, menuCode)
        if (menu) {
          if (!menuPermissionsMap.value[menu.id]) {
            menuPermissionsMap.value[menu.id] = []
          }
          if (!menuPermissionsMap.value[menu.id].includes(op)) {
            menuPermissionsMap.value[menu.id].push(op)
          }
        }
      }
    })
  } catch (error) {
    console.error('获取角色权限失败:', error)
    menuPermissionsMap.value = {}
  }

  menuDialogVisible.value = true

  // 清除之前的定时器，防止多次快速打开对话框时旧的定时器覆盖新的状态
  if (setCheckedKeysTimer) {
    clearTimeout(setCheckedKeysTimer)
  }

  // 使用 setTimeout 确保 DOM 渲染完成后再设置选中状态
  setCheckedKeysTimer = setTimeout(() => {
    if (menuDialogVisible.value && menuTreeRef.value && menuTreeRef.value.setCheckedKeys) {
      menuTreeRef.value.setCheckedKeys(selectedMenuIds.value)
    }
    setCheckedKeysTimer = null
  }, 100)
}

// 根据菜单code查找菜单
const findMenuByCode = (menus, code) => {
  for (const menu of menus) {
    if (menu.code === code) return menu
    if (menu.children) {
      const found = findMenuByCode(menu.children, code)
      if (found) return found
    }
  }
  return null
}

onMounted(() => {
  fetchRoles()
})
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>角色菜单权限</span>
      </template>

      <el-table :data="roleList" v-loading="roleLoading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="角色名称" />
        <el-table-column prop="describe" label="描述" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="menus" label="拥有菜单" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="menuNamesCache[row.id] || '无'" placement="top" :disabled="!menuNamesCache[row.id]">
              <span class="menu-names">{{ menuNamesCache[row.id] || '无' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleMenuAuth(row)" v-if="userStore.hasPermission('roleMenu:edit')">分配菜单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="menuDialogVisible" title="分配菜单和权限" width="800px">
      <div style="display: flex; gap: 20px;">
        <div style="flex: 1;">
          <h4>选择菜单</h4>
          <el-tree
            ref="menuTreeRef"
            :data="allMenus"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            :default-expand-all="true"
            show-checkbox
            check-strictly
            @check="handleMenuCheck"
            style="max-height: 400px; overflow-y: auto;"
          />
        </div>
        <div style="flex: 1;">
          <h4>选择权限</h4>
          <div v-if="selectedMenuIds.length === 0" style="color: #999;">
            请先在左侧选择菜单
          </div>
          <div v-else style="max-height: 400px; overflow-y: auto;">
            <div v-for="menuId in sortedSelectedMenuIds" :key="menuId" style="margin-bottom: 15px;">
              <template v-if="findMenuById(allMenus, menuId)?.parent_id === 0">
                <div style="font-weight: bold; margin-bottom: 8px; color: #999;">
                  {{ findMenuById(allMenus, menuId)?.name }} （顶级菜单，无需配置权限）
                </div>
              </template>
              <template v-else>
                <div style="font-weight: bold; margin-bottom: 8px;">
                  {{ findMenuById(allMenus, menuId)?.name }}
                </div>
                <div style="padding-left: 20px;">
                  <el-checkbox
                    v-for="op in operationTypes"
                    :key="op.value"
                    :model-value="isPermissionChecked(menuId, op.value)"
                    @update:model-value="(checked) => toggleMenuPermission(menuId, op.value, checked)"
                  >
                    {{ op.label }}
                  </el-checkbox>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="menuDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleMenuAuthSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container {
  padding: 20px;
}

.menu-names {
  display: inline-block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
