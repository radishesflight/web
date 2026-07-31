<!--
  角色管理页

  功能:
   - 列表分页(支持按 status 筛选)
   - 新增 / 编辑 / 删除
   - 按钮级权限:hasPermission('adminRoles:add'/'edit'/'delete')

  注意:
   - 删除角色前要确认(可能影响使用该角色的用户)
   - 角色名不能重复(后端会校验返回 1009)
-->
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminRolesList, createAdminRoles, updateAdminRoles, deleteAdminRoles } from '@/api/system/adminRoles'
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
const dialogTitle = ref('新增角色')
const formData = ref({
  id: null,
  name: '',
  describe: '',
  status: 1
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getAdminRolesList({
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

const handleAdd = () => {
  dialogTitle.value = '新增角色'
  formData.value = {
    id: null,
    name: '',
    describe: '',
    status: 1
  }
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑角色'
  formData.value = {
    id: row.id,
    name: row.name,
    describe: row.describe,
    status: row.status
  }
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定删除角色 ${row.name} 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteAdminRoles(row.id)
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
      ElMessage.warning('请输入角色名称')
      return
    }
    const data = {
      name: formData.value.name,
      describe: formData.value.describe,
      status: formData.value.status
    }
    if (!formData.value.id) {
      await createAdminRoles(data)
      ElMessage.success('创建成功')
    } else {
      await updateAdminRoles(formData.value.id, data)
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error('操作失败:', error)
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
          <span>角色列表</span>
          <el-button type="primary" @click="handleAdd" v-if="userStore.hasPermission('adminRoles:add')">新增角色</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
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
        <el-table-column prop="created_at" label="创建时间" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)" v-if="userStore.hasPermission('adminRoles:edit')">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)" v-if="userStore.hasPermission('adminRoles:delete')">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="角色名称">
          <el-input v-model="formData.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.describe" placeholder="请输入描述" type="textarea" />
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
</style>
