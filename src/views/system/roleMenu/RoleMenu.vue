<!--
  角色权限分配(只做"分配菜单和路由",不含角色 CRUD)

  数据流:
  1. AdminRoles.vue 点"分配权限"→ 把 roleId 存 Pinia → 跳到本页面
  2. 本页面从 Pinia 拿 roleId,加载该角色的菜单和路由
  3. 用户编辑后保存 → 调 assign 接口

  设计要点:
  - 所有数据从后端 dynamic 拿(routes、menus),不写死
  - 加新菜单/新接口,前端不用改代码(只要在 admin_menu_operations 表加一行)
  - 父子联动:check-strictly + 自定义级联(选父→全选子,选子→勾父)
  - 路由按菜单分组,每行显示 [METHOD] /path - 名称
-->
<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getAllMenus,
  getRoleMenuIDs,
  getRoleRouteIDs,
  assignMenusAndOperations
} from '@/api/system/roleMenu'
import { getAdminRolesList } from '@/api/system/adminRoles'
import { useUserStore } from '@/stores/user'
import { useRoleSelectionStore } from '@/stores/roleSelection'

const userStore = useUserStore()
const roleSelectionStore = useRoleSelectionStore()
const route = useRoute()

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

// ============= 菜单树 + 路由权限 =============
const allMenus = ref([])               // 菜单树(给 el-tree 用)
const selectedMenuIds = ref([])        // 已勾选的菜单 ID
const menuRoutesMap = ref({})          // { menu_id: [{id, method, path, name}] }
const selectedRouteIds = ref([])       // 已勾选的路由 ID
const treeRef = ref(null)
const saving = ref(false)

// 排序后的已选菜单(树形展开成平铺,按父→子顺序)
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

// 菜单勾选联动:选父→全选子,选子→勾父,反选子→若父下已无选中子则取消父
const handleCheck = (data, checkedObj) => {
  const isChecked = checkedObj.checkedKeys.includes(data.id)
  const menuSet = new Set(checkedObj.checkedKeys)
  const routeSet = new Set(selectedRouteIds.value)

  if (isChecked) {
    // 选父→全选子
    if (data.children && data.children.length > 0) {
      const collectAll = (nodes) => {
        nodes.forEach(n => {
          menuSet.add(n.id)
          if (n.children && n.children.length > 0) collectAll(n.children)
        })
      }
      collectAll(data.children)
    }
    // 选子→勾父
    let parentId = data.parent_id
    while (parentId && parentId !== 0) {
      menuSet.add(parentId)
      const parent = findMenuById(allMenus.value, parentId)
      parentId = parent ? parent.parent_id : 0
    }
  } else {
    // 取消父→全取消子
    if (data.children && data.children.length > 0) {
      const removeAll = (nodes) => {
        nodes.forEach(n => {
          menuSet.delete(n.id)
          if (n.children && n.children.length > 0) removeAll(n.children)
        })
      }
      removeAll(data.children)
    }
    // 取消子→看父下是否还有选中子,没有就取消父
    const tryRemoveParents = (childMenuId) => {
      const menu = findMenuById(allMenus.value, childMenuId)
      if (!menu || !menu.parent_id) return
      const parent = findMenuById(allMenus.value, menu.parent_id)
      if (!parent) return
      const siblings = parent.children || []
      const hasSelectedSibling = siblings.some(s =>
        s.id !== childMenuId && menuSet.has(s.id)
      )
      if (!hasSelectedSibling) {
        menuSet.delete(parent.id)
        tryRemoveParents(parent.id)
      }
    }
    if (data.parent_id) tryRemoveParents(data.id)
  }

  selectedMenuIds.value = [...menuSet]

  // 菜单选中后,该菜单下所有路由自动加入
  menuSet.forEach(menuId => {
    const routes = menuRoutesMap.value[menuId] || []
    routes.forEach(r => routeSet.add(r.id))
  })
  // 菜单取消后,该菜单下所有路由也取消
  // (只取消"已选菜单集合"之外的菜单的路由)
  selectedRouteIds.value = [...routeSet].filter(rid => {
    const route = findRouteById(rid)
    return route && menuSet.has(route.menu_id)
  })

  nextTick(() => {
    if (treeRef.value) treeRef.value.setCheckedKeys([...menuSet], false)
  })
}

const findRouteById = (id) => {
  for (const routes of Object.values(menuRoutesMap.value)) {
    for (const r of routes) {
      if (r.id === id) return r
    }
  }
  return null
}

const isRouteChecked = (routeId) => selectedRouteIds.value.includes(routeId)

const toggleRoute = (routeId, checked) => {
  const set = new Set(selectedRouteIds.value)
  if (checked) set.add(routeId)
  else set.delete(routeId)
  selectedRouteIds.value = [...set]
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
      roots.push(map[m.id])
    }
  }
  return roots
}

const fetchAllMenus = async () => {
  try {
    const res = await getAllMenus()
    allMenus.value = buildMenuTree(res.data)

    // 收集所有菜单的 routes(按 menu_id)
    // 后端字段名是 "operations"(沿用),实际是 (method, path) 形式
    const routeMap = {}
    const collect = (menus) => {
      for (const m of menus) {
        if (m.operations && m.operations.length > 0) routeMap[m.id] = m.operations
        if (m.children && m.children.length > 0) collect(m.children)
      }
    }
    collect(allMenus.value)
    menuRoutesMap.value = routeMap
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
    // 1. 加载已分配的菜单
    const menuRes = await getRoleMenuIDs(selectedRoleId.value)
    let menuIds = menuRes.data.menu_ids || []
    menuIds = fillParents(menuIds)
    selectedMenuIds.value = menuIds

    // 2. 加载已分配的路由
    const routeRes = await getRoleRouteIDs(selectedRoleId.value)
    selectedRouteIds.value = routeRes.data.route_ids || []
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
    await assignMenusAndOperations({
      role_id: selectedRoleId.value,
      menu_ids: selectedMenuIds.value,
      route_ids: selectedRouteIds.value
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
        <span class="page-title">分配菜单和路由权限</span>
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
        v-if="userStore.hasRoute('PUT', '/api/system/roleMenu/assign')"
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
        <h4>选择接口权限</h4>
        <div v-if="selectedMenuIds.length === 0" class="empty-op">请先在左侧勾选菜单</div>
        <div v-else class="op-list">
          <div
            v-for="menuId in sortedSelectedMenuIds"
            :key="menuId"
            class="op-block"
          >
            <template v-if="!menuRoutesMap[menuId] || menuRoutesMap[menuId].length === 0">
              <div class="op-menu-name">{{ findMenuById(allMenus, menuId)?.name }}</div>
              <div class="op-no-ops">该菜单暂未配置接口</div>
            </template>
            <template v-else>
              <div class="op-menu-name">{{ findMenuById(allMenus, menuId)?.name }}</div>
              <div class="op-checkboxes">
                <el-checkbox
                  v-for="r in menuRoutesMap[menuId]"
                  :key="r.id"
                  :model-value="isRouteChecked(r.id)"
                  @update:model-value="(v) => toggleRoute(r.id, v)"
                >
                  <span class="route-tag" :class="`method-${r.method.toLowerCase()}`">{{ r.method }}</span>
                  <code class="route-path">{{ r.path }}</code>
                  <span class="route-name">- {{ r.name }}</span>
                </el-checkbox>
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
  flex-direction: column;
  gap: 6px;
  padding-left: 8px;
}
.op-no-ops { color: #999; font-size: 12px; padding-left: 8px; }
.empty-tip { flex: 1; display: flex; align-items: center; justify-content: center; }
.empty-op { color: #999; padding: 20px; text-align: center; }

/* 路由行的样式:方法徽章 + 路径 + 名称 */
.route-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 4px;
  color: #fff;
}
.method-get    { background: #67c23a; }
.method-post   { background: #409eff; }
.method-put    { background: #e6a23c; }
.method-delete { background: #f56c6c; }
.route-path {
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  color: #606266;
  margin-right: 4px;
}
.route-name {
  color: #909399;
  font-size: 12px;
}
</style>
