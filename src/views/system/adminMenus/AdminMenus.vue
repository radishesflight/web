<!--
  菜单管理页

  功能:
   - 列表分页(sort asc)
   - 上级菜单选择(parent_id = 0 的菜单)
   - 图标选择器(用 Element Plus 全部图标)
   - 新增 / 编辑 / 删除
   - 每行菜单的"管理操作"按钮 -> 抽屉式管理该菜单下的 operation(API 权限元数据)
   - 按钮级权限:hasRoute('POST', '/api/system/adminMenus')/'PUT'/'DELETE' 等

  关键点:
   - 菜单 code(如 "adminUsers")被后端用来推断权限:code:operation
   - parent_id 0 = 顶级菜单(目录)
   - 图标用 element-plus 的图标 name,存进 DB 后前端用 <component :is> 渲染
   - operation = (method, path) 一条具体接口的权限元数据,由 admin_menu_operations 存储
     启动时 SyncRoutes 会自动从 gin 路由扫描新增,这里只用来改中文名 / sort / 删除多余项
-->
<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import {
  getAdminMenusList,
  getAdminMenusOptions,
  createAdminMenus,
  updateAdminMenus,
  deleteAdminMenus,
  getMenuOperations,
  createOperation,
  updateOperation,
  deleteOperation
} from '@/api/system/adminMenus'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const tableData = ref([])
const loading = ref(false)
const pagination = ref({
  page: 1,
  size: 10,
  total: 0
})

const dialogVisible = ref(false)
const dialogTitle = ref('新增菜单')
const formData = ref({
  id: null,
  name: '',
  code: '',
  path: '',
  icon: '',
  parent_id: 0,
  sort: 0,
  status: 1
})

const parentMenuOptions = ref([])
const parentMenuLoading = ref(false)

const iconDialogVisible = ref(false)
const searchQuery = ref('')
const iconList = computed(() => Object.keys(ElementPlusIconsVue))
const filteredIconList = ref([])

// =====================================================
// operation 管理(弹窗式抽屉)
// =====================================================
const opsDrawerVisible = ref(false)
const opsCurrentMenu = ref(null) // 当前选中的菜单
const opsList = ref([])
const opsLoading = ref(false)
const opsDialogVisible = ref(false)
const opsDialogTitle = ref('新增操作')
const opsForm = ref({
  id: null,
  menu_id: 0,
  method: 'GET',
  path: '',
  name: '',
  sort: 0
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getAdminMenusList({
      page: pagination.value.page,
      size: pagination.value.size
    })
    tableData.value = res.data.list
    pagination.value.total = res.data.total
  } catch (error) {
    console.error('获取列表失败:', error)
  } finally {
    loading.value = false
  }
}

const loadParentMenuOptions = async () => {
  parentMenuLoading.value = true
  try {
    const res = await getAdminMenusOptions()
    parentMenuOptions.value = res.data
  } catch (error) {
    console.error('获取上级菜单失败:', error)
  } finally {
    parentMenuLoading.value = false
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增菜单'
  formData.value = {
    id: null,
    name: '',
    code: '',
    path: '',
    icon: '',
    parent_id: 0,
    sort: 0,
    status: 1
  }
  loadParentMenuOptions()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑菜单'
  formData.value = {
    id: row.id,
    name: row.name,
    code: row.code,
    path: row.path,
    icon: row.icon,
    parent_id: row.parent_id,
    sort: row.sort,
    status: row.status
  }
  loadParentMenuOptions()
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定删除菜单 ${row.name} 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteAdminMenus(row.id)
      ElMessage.success('删除成功')
      fetchData()
    } catch (error) {
      console.error('删除失败:', error)
    }
  })
}

const handleSubmit = async () => {
  try {
    if (!formData.value.name) {
      ElMessage.warning('请输入菜单名称')
      return
    }
    if (!formData.value.code) {
      ElMessage.warning('请输入菜单编码')
      return
    }
    const data = {
      name: formData.value.name,
      code: formData.value.code,
      path: formData.value.path,
      icon: formData.value.icon,
      parent_id: formData.value.parent_id,
      sort: formData.value.sort,
      status: formData.value.status
    }
    if (!formData.value.id) {
      await createAdminMenus(data)
      ElMessage.success('创建成功')
    } else {
      await updateAdminMenus(formData.value.id, data)
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error('操作失败:', error)
  }
}

const openIconPicker = () => {
  searchQuery.value = ''
  filteredIconList.value = iconList.value
  iconDialogVisible.value = true
}

const handleIconSearch = () => {
  if (!searchQuery.value) {
    filteredIconList.value = iconList.value
  } else {
    filteredIconList.value = iconList.value.filter(name =>
      name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
}

const selectIcon = (iconName) => {
  formData.value.icon = iconName
  iconDialogVisible.value = false
  ElMessage.success(`已选择图标: ${iconName}`)
}

// =====================================================
// operation 管理相关
// =====================================================
const openOperationsDrawer = async (row) => {
  opsCurrentMenu.value = row
  opsDrawerVisible.value = true
  await fetchOperations()
}

const fetchOperations = async () => {
  if (!opsCurrentMenu.value) return
  opsLoading.value = true
  try {
    const res = await getMenuOperations(opsCurrentMenu.value.id)
    opsList.value = res.data || []
  } catch (error) {
    console.error('获取操作列表失败:', error)
    opsList.value = []
  } finally {
    opsLoading.value = false
  }
}

const handleAddOperation = () => {
  opsDialogTitle.value = '新增操作'
  opsForm.value = {
    id: null,
    menu_id: opsCurrentMenu.value?.id || 0,
    method: 'GET',
    path: '',
    name: '',
    sort: 0
  }
  opsDialogVisible.value = true
}

const handleEditOperation = (row) => {
  opsDialogTitle.value = '编辑操作'
  opsForm.value = {
    id: row.id,
    menu_id: row.menu_id,
    method: row.method,
    path: row.path,
    name: row.name,
    sort: row.sort
  }
  opsDialogVisible.value = true
}

const handleDeleteOperation = (row) => {
  ElMessageBox.confirm(
    `确定删除操作 [${row.method} ${row.path}] 吗?\n同时会清掉所有角色的关联(此操作的权限)。`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await deleteOperation(row.id)
      ElMessage.success('删除成功')
      await fetchOperations()
    } catch (error) {
      console.error('删除操作失败:', error)
    }
  })
}

const handleSubmitOperation = async () => {
  try {
    if (!opsForm.value.path) {
      ElMessage.warning('请输入路径')
      return
    }
    if (!opsForm.value.id && !opsForm.value.method) {
      ElMessage.warning('请选择 HTTP 方法')
      return
    }
    if (opsForm.value.id) {
      // 更新:只改 name / sort / menu_id
      await updateOperation(opsForm.value.id, {
        menu_id: opsForm.value.menu_id,
        name: opsForm.value.name,
        sort: opsForm.value.sort
      })
      ElMessage.success('更新成功')
    } else {
      // 新增
      await createOperation({
        menu_id: opsForm.value.menu_id,
        method: opsForm.value.method,
        path: opsForm.value.path,
        name: opsForm.value.name,
        sort: opsForm.value.sort
      })
      ElMessage.success('创建成功')
    }
    opsDialogVisible.value = false
    await fetchOperations()
  } catch (error) {
    console.error('保存操作失败:', error)
  }
}

const methodTagType = (m) => {
  switch ((m || '').toUpperCase()) {
    case 'GET':
      return ''
    case 'POST':
      return 'success'
    case 'PUT':
      return 'warning'
    case 'DELETE':
      return 'danger'
    default:
      return 'info'
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>菜单列表</span>
          <el-button type="primary" @click="handleAdd" v-if="userStore.hasRoute('POST', '/api/system/adminMenus')">新增菜单</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="菜单名称" />
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="path" label="路径" />
        <el-table-column prop="icon" label="图标" width="120">
          <template #default="{ row }">
            <el-icon :size="24" v-if="row.icon">
              <component :is="row.icon" />
            </el-icon>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" />
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)" v-if="userStore.hasRoute('PUT', '/api/system/adminMenus/:id')">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)" v-if="userStore.hasRoute('DELETE', '/api/system/adminMenus/:id')">删除</el-button>
            <el-button type="success" size="small" @click="openOperationsDrawer(row)" v-if="userStore.hasRoute('GET', '/api/system/adminMenus/operations/:menu_id')">管理操作</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="菜单名称">
          <el-input v-model="formData.name" placeholder="请输入菜单名称" />
        </el-form-item>
        <el-form-item label="菜单编码">
          <el-input v-model="formData.code" placeholder="如: adminUsers" />
        </el-form-item>
        <el-form-item label="路径">
          <el-input v-model="formData.path" placeholder="请输入路径" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-selector">
            <el-icon :size="32" v-if="formData.icon">
              <component :is="formData.icon" />
            </el-icon>
            <span v-else class="no-icon">未选择</span>
            <el-button type="primary" size="small" @click="openIconPicker">选择图标</el-button>
          </div>
        </el-form-item>
        <el-form-item label="上级菜单">
          <el-select
            v-model="formData.parent_id"
            placeholder="请选择上级菜单"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option label="无上级菜单" :value="0" />
            <el-option
              v-for="menu in parentMenuOptions"
              :key="menu.id"
              :label="menu.name"
              :value="menu.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input v-model="formData.sort" placeholder="请输入排序" type="number" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="formData.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="iconDialogVisible" title="选择图标" width="600px">
      <el-input v-model="searchQuery" placeholder="搜索图标" @input="handleIconSearch" style="margin-bottom: 15px;" />
      <div class="icon-grid">
        <div
          v-for="iconName in filteredIconList"
          :key="iconName"
          class="icon-item"
          :class="{ selected: formData.icon === iconName }"
          @click="selectIcon(iconName)"
        >
          <el-icon :size="24">
            <component :is="iconName" />
          </el-icon>
          <span class="icon-name">{{ iconName }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- operation 管理抽屉 -->
    <el-drawer
      v-model="opsDrawerVisible"
      :title="`操作管理 - ${opsCurrentMenu?.name || ''}`"
      direction="rtl"
      size="70%"
    >
      <div class="ops-drawer">
        <div class="ops-toolbar">
          <span class="ops-tip">
            一条操作 = 一个具体接口的权限元数据 (method + path)<br>
            <small>启动时 SyncRoutes 会从 gin 路由自动扫描新增;这里用来改中文名 / sort / 删除多余项</small>
          </span>
          <el-button
            type="primary"
            @click="handleAddOperation"
            v-if="userStore.hasRoute('POST', '/api/system/adminMenus/operations')"
          >
            新增操作
          </el-button>
        </div>

        <el-table :data="opsList" v-loading="opsLoading" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="方法" width="100">
            <template #default="{ row }">
              <el-tag :type="methodTagType(row.method)" size="small">{{ row.method }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="路径" min-width="200" />
          <el-table-column prop="name" label="中文名" min-width="160" />
          <el-table-column prop="sort" label="排序" width="80" />
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click="handleEditOperation(row)"
                v-if="userStore.hasRoute('PUT', '/api/system/adminMenus/operations/:id')"
              >
                编辑
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="handleDeleteOperation(row)"
                v-if="userStore.hasRoute('DELETE', '/api/system/adminMenus/operations/:id')"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <!-- operation 新增/编辑对话框 -->
    <el-dialog v-model="opsDialogVisible" :title="opsDialogTitle" width="500px">
      <el-form :model="opsForm" label-width="80px">
        <el-form-item label="HTTP方法">
          <el-select v-model="opsForm.method" :disabled="!!opsForm.id" style="width: 100%">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
            <el-option label="PUT" value="PUT" />
            <el-option label="DELETE" value="DELETE" />
          </el-select>
        </el-form-item>
        <el-form-item label="路径">
          <el-input
            v-model="opsForm.path"
            placeholder="如: /api/system/adminMenus/operations/:id"
            :disabled="!!opsForm.id"
          />
        </el-form-item>
        <el-form-item label="中文名">
          <el-input v-model="opsForm.name" placeholder="给管理员看的中文名,如: 新增菜单" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="opsForm.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item v-if="opsForm.id" label="所属菜单">
          <el-select v-model="opsForm.menu_id" style="width: 100%">
            <el-option
              v-for="m in tableData"
              :key="m.id"
              :label="m.name"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="opsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitOperation">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.icon-selector {
  display: flex;
  align-items: center;
  gap: 15px;
}

.no-icon {
  color: #999;
  font-size: 14px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-item:hover {
  border-color: #409EFF;
  background-color: #f0f9ff;
}

.icon-item.selected {
  border-color: #409EFF;
  background-color: #ecf5ff;
}

.icon-name {
  font-size: 12px;
  margin-top: 5px;
  color: #666;
}

/* operation drawer 内部样式 */
.ops-drawer {
  padding: 0 20px 20px;
}

.ops-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.ops-tip {
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.ops-tip small {
  color: #909399;
  font-size: 12px;
}
</style>
