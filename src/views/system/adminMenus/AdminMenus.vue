<!--
  菜单管理页

  功能:
   - 列表分页(sort asc)
   - 上级菜单选择(parent_id = 0 的菜单)
   - 图标选择器(用 Element Plus 全部图标)
   - 新增 / 编辑 / 删除
   - 按钮级权限:hasPermission('adminMenus:add'/'edit'/'delete')

  关键点:
   - 菜单 code(如 "adminUsers")被后端用来推断权限:code:operation
   - parent_id 0 = 顶级菜单(目录)
   - 图标用 element-plus 的图标 name,存进 DB 后前端用 <component :is> 渲染
-->
<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { getAdminMenusList, getAdminMenusOptions, createAdminMenus, updateAdminMenus, deleteAdminMenus } from '@/api/system/adminMenus'
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
          <el-button type="primary" @click="handleAdd" v-if="userStore.hasPermission('adminMenus:add')">新增菜单</el-button>
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
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)" v-if="userStore.hasPermission('adminMenus:edit')">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)" v-if="userStore.hasPermission('adminMenus:delete')">删除</el-button>
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
</style>
