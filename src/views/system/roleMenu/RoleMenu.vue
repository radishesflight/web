<!--
  角色权限分配(只做"分配菜单和操作",不含角色 CRUD)

  数据流:
  1. AdminRoles.vue 点"分配权限"→ 把 roleId 存 Pinia → 跳到本页面
  2. 本页面从 Pinia 拿 roleId,加载该角色的菜单和操作
  3. 用户编辑后保存 → 调 assign 接口

  设计要点:
  - 所有数据从后端 dynamic 拿(operations、menus),不写死
  - 加新菜单/新操作,前端不用改代码
  - 父子联动:check-strictly + 自定义级联(选父→全选子,选子→勾父)
-->
<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  getAllMenus,
  getRoleMenuIDs,
  getRoleOperationCodes,
  assignMenusAndOperations
} from '@/api/system/roleMenu'
import { getAdminRolesList } from '@/api/system/adminRoles'
import { useUserStore } from '@/stores/user'
import { useRoleSelectionStore } from '@/stores/roleSelection'

const userStore = useUserStore()
const roleSelectionStore = useRoleSelectionStore()
const route = useRoute()
const router = useRouter()

// 当前选中的角色(从 store 或 URL query 拿)
const selectedRoleId = ref(null)
const currentRole = ref(null)
const roleList = ref([])

const loadRoleList = async () => {
  try {
    const res = await getAdminRolesList({ page: 1, size: 100 })
    roleList.value = res.data.list
  } catch (e) {
    console.error('获取角色列表失败:', e)
  }
}

// 初始化:从 store 或 query 拿 roleId
const initRole = async () => {
  let id = route.query.role_id || roleSelectionStore.selectedRoleId
  if (!id && roleList.value.length > 0) {
    id = roleList.value[0].id
  }
  if (id) {
    selectedRoleId.value = Number(id)
    currentRole.value = roleList.value.find(r => r.id === selectedRoleId.value) || null
  }
}

const switchRole = (id) => {
  selectedRoleId.value = id
  currentRole.value = roleList.value.find(r => r.id === id) || null
  roleSelectionStore.setSelectedRoleId(id)
  loadAssignment()
}

// ============= 菜单树 + 操作权限 =============
const allMenus = ref([])
const selectedMenuIds = ref([])
const menuOperationsMap = ref({}) // { menu_id: [{id, code, name, ...}] }
const menuPermissionsMap = ref({}) // { menu_id: ['view', 'add', ...] }
const treeRef = ref(null)
const saving = ref(false)

const sortedSelectedMenuIds = computed(() => {
  const flattenMenu = (menus) => {
    const result = []
    for (const m of menus) {
      result.push(m)
      if (m.children && m.children.length > 0) result.push(...flattenMenu(m.children))
    }
    return result
  }
  return flattenMenu(allMenus.value)
    .filter(m => selectedMenuIds.value.includes(m.id))
    .map(m => m.id)
})

const findMenuById = (menus, id) => {
  for (const m of menus) {
    if (m.id === id) return m
    if (m.children) {
      const found = findMenuById(m.children, id)
      if (found) return found
    }
  }
  return null
}

const handleCheck = (data, checkedObj) => {
  const isChecked = checkedObj.checkedKeys.includes(data.id)
  const checkedSet = new Set(checkedObj.checkedKeys)

  if (isChecked) {
    if (data.children && data.children.length > 0) {
      const collectAll = (nodes) => {
        nodes.forEach(n => {
          checkedSet.add(n.id)
          if (n.children && n.children.length > 0) collectAll(n.children)
        })
      }
      collectAll(data.children)
    }
    let parentId = data.parent_id
    while (parentId && parentId !== 0) {
      checkedSet.add(parentId)
      const parent = findMenuById(allMenus.value, parentId)
      parentId = parent ? parent.parent_id : 0
    }
  } else {
    if (data.children && data.children.length > 0) {
      const removeAll = (nodes) => {
        nodes.forEach(n => {
          checkedSet.delete(n.id)
          if (n.children && n.children.length > 0) removeAll(n.children)
        })
      }
      removeAll(data.children)
    }
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
    if (data.parent_id) tryRemoveParents(data.id)
  }

  selectedMenuIds.value = [...checkedSet]
  nextTick(() => {
    if (treeRef.value) treeRef.value.setCheckedKeys([...checkedSet], false)
  })
  checkedSet.forEach(menuId => {
    if (!menuPermissionsMap.value[menuId] && menuOperationsMap.value[menuId]) {
      menuPermissionsMap.value[menuId] = menuOperationsMap.value[menuId].map(op => op.code)
    }
  })
}

const isOpChecked = (menuId, opCode) => {
  return menuPermissionsMap.value[menuId]?.includes(opCode) || false
}

const toggleOp = (menuId, opCode, checked) => {
  if (!menuPermissionsMap.value[menuId]) menuPermissionsMap.value[menuId] = []
  if (checked) {
    if (!menuPermissionsMap.value[menuId].includes(opCode)) {
      menuPermissionsMap.value[menuId].push(opCode)
    }
  } else {
    menuPermissionsMap.value[menuId] = menuPermissionsMap.value[menuId].filter(c => c !== opCode)
  }
}

// 把扁平 list 构建成树(根据 parent_id)
const buildMenuTree = (flat) => {
  const map = {}
  const roots = []
  for (const m of flat) map[m.id] = { ...m, children: [] }
  for (const m of flat) {
    if (m.parent_id === 0 || !m.parent_id) {
      roots.push(map[m.id])
    } else if (map[m.parent_id]) {
      map[m.parent_id].children.push(map[m.id])
    } else {
      // 孤儿节点(找不到 parent)挂根上
      roots.push(map[m.id])
    }
  }
  return roots
}

const fetchAllMenus = async () => {
  try {
    const res = await getAllMenus()
    // 后端返回扁平 list,前端构树(给 el-tree 用)
    allMenus.value = buildMenuTree(res.data)

    // 收集所有菜单的 operations(按 menu_id)
    const opMap = {}
    const collect = (menus) => {
      for (const m of menus) {
        if (m.operations && m.operations.length > 0) opMap[m.id] = m.operations
        if (m.children && m.children.length > 0) collect(m.children)
      }
    }
    collect(allMenus.value)
    menuOperationsMap.value = opMap
  } catch (e) {
    console.error('获取菜单失败:', e)
  }
}

// 任一子被勾,父必勾(递归向上补全)
const fillParents = (ids) => {
  const set = new Set(ids)
  const queue = [...ids]
  while (queue.length > 0) {
    const id = queue.shift()
    const m = findMenuById(allMenus.value, id)
    if (m && m.parent_id && m.parent_id !== 0 && !set.has(m.parent_id)) {
      set.add(m.parent_id)
      queue.push(m.parent_id)
    }
  }
  return [...set]
}

const loadAssignment = async () => {
  if (!selectedRoleId.value) return
  try {
    const menuRes = await getRoleMenuIDs(selectedRoleId.value)
    let menuIds = menuRes.data.menu_ids || []
    // 向上联动:任一子被勾,父必勾
    menuIds = fillParents(menuIds)
    selectedMenuIds.value = menuIds

    const opRes = await getRoleOperationCodes(selectedRoleId.value)
    const opMap = {}
    for (const [k, v] of Object.entries(opRes.data.operations || {})) {
      opMap[Number(k)] = v
    }
    menuPermissionsMap.value = opMap
  } catch (e) {
    console.error('加载角色分配失败:', e)
  }
  await nextTick()
  if (treeRef.value && selectedMenuIds.value.length > 0) {
    treeRef.value.setCheckedKeys(selectedMenuIds.value, false)
  }
}

const handleSave = async () => {
  if (!selectedRoleId.value) {
    ElMessage.warning('请先选择角色')
    return
  }
  saving.value = true
  try {
    const operations = {}
    for (const [k, v] of Object.entries(menuPermissionsMap.value)) {
      operations[Number(k)] = v
    }
    await assignMenusAndOperations({
      role_id: selectedRoleId.value,
      menu_ids: selectedMenuIds.value,
      operations
    })
    ElMessage.success('分配成功,使用该角色的用户需重新登录')
  } catch (e) {
    console.error('保存失败:', e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadRoleList(), fetchAllMenus()])
  await initRole()
  if (selectedRoleId.value) {
    await loadAssignment()
  }
})

// 监听 query 变化(从 AdminRoles 跳转过来时 roleId 在 query)
watch(() => route.query.role_id, (newId) => {
  if (newId && Number(newId) !== selectedRoleId.value) {
    switchRole(Number(newId))
  }
})
</script>

<template>
  <div class="role-menu-page">
    <!-- 顶部:角色选择 + 保存 -->
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">分配菜单和操作权限</span>
        <el-select
          v-if="roleList.length > 0"
          v-model="selectedRoleId"
          @change="switchRole"
          placeholder="选择角色"
          style="margin-left: 16px; width: 200px;"
        >
          <el-option
            v-for="r in roleList"
            :key="r.id"
            :label="r.name"
            :value="r.id"
          />
        </el-select>
      </div>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!selectedRoleId"
        @click="handleSave"
        v-if="userStore.hasPermission('roleMenu:edit')"
      >保存分配</el-button>
    </div>

    <div v-if="!selectedRoleId" class="empty-tip">
      <el-empty description="请先在'角色管理'页选择一个角色" />
    </div>

    <div v-else class="assignment-body">
      <div class="tree-section">
        <h4>选择菜单</h4>
        <el-tree
          ref="treeRef"
          :data="allMenus"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          :default-expand-all="true"
          show-checkbox
          check-strictly
          @check="handleCheck"
          class="menu-tree"
        />
      </div>
      <div class="op-section">
        <h4>选择操作权限</h4>
        <div v-if="selectedMenuIds.length === 0" class="empty-op">请先在左侧勾选菜单</div>
        <div v-else class="op-list">
          <div
            v-for="menuId in sortedSelectedMenuIds"
            :key="menuId"
            class="op-block"
          >
            <template v-if="!menuOperationsMap[menuId] || menuOperationsMap[menuId].length === 0">
              <div class="op-menu-name">{{ findMenuById(allMenus, menuId)?.name }}</div>
              <div class="op-no-ops">该菜单暂未配置操作</div>
            </template>
            <template v-else>
              <div class="op-menu-name">{{ findMenuById(allMenus, menuId)?.name }}</div>
              <div class="op-checkboxes">
                <el-checkbox
                  v-for="op in menuOperationsMap[menuId]"
                  :key="op.id"
                  :model-value="isOpChecked(menuId, op.code)"
                  @update:model-value="(v) => toggleOp(menuId, op.code, v)"
                >{{ op.name }}</el-checkbox>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-menu-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  padding: 16px;
  background: #fff;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}
.header-left {
  display: flex;
  align-items: center;
}
.page-title {
  font-weight: 600;
  font-size: 16px;
}
.assignment-body {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.tree-section, .op-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tree-section h4, .op-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}
.menu-tree {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 8px;
}
.op-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
}
.op-block {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #ebeef5;
}
.op-block:last-child { border-bottom: none; }
.op-menu-name { font-weight: 500; margin-bottom: 6px; }
.op-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding-left: 8px;
}
.op-no-ops { color: #999; font-size: 12px; padding-left: 8px; }
.empty-tip { flex: 1; display: flex; align-items: center; justify-content: center; }
.empty-op { color: #999; padding: 20px; text-align: center; }
</style>
