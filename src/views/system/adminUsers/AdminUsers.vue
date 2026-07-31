<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminUsersList, createAdminUsers, updateAdminUsers, deleteAdminUsers } from '@/api/system/adminUsers'
import { getAdminRolesList } from '@/api/system/adminRoles'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const tableData = ref([])
const loading = ref(false)
const pagination = ref({
  page: 1,
  size: 10,
  total: 0
})
const rolesList = ref([])

const dialogVisible = ref(false)
const dialogTitle = ref('新增管理员')
const formData = ref({
  id: null,
  username: '',
  password: '',
  email: '',
  phone: '',
  status: 1,
  role_id: null
})

const fetchRoles = async () => {
  try {
    const res = await getAdminRolesList({ page: 1, size: 100 })
    rolesList.value = res.data.list || []
  } catch (error) {
    console.error('获取角色列表失败:', error)
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getAdminUsersList({
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
  dialogTitle.value = '新增管理员'
  formData.value = {
    id: null,
    username: '',
    password: '',
    email: '',
    phone: '',
    status: 1,
    role_id: null
  }
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑管理员'
  formData.value = {
    id: row.id,
    username: row.username,
    password: '',
    email: row.email,
    phone: row.phone,
    status: row.status,
    role_id: row.role_id
  }
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定删除管理员 ${row.username} 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteAdminUsers(row.id)
      ElMessage.success('删除成功')
      fetchData()
    } catch (error) {
      console.error('删除失败:', error)
    }
  })
}

const handleSubmit = async () => {
  try {
    const data = {
      email: formData.value.email,
      phone: formData.value.phone,
      status: formData.value.status,
      role_id: formData.value.role_id
    }
    if (!formData.value.id) {
      if (!formData.value.password) {
        ElMessage.warning('请输入密码')
        return
      }
      data.username = formData.value.username
      data.password = formData.value.password
      await createAdminUsers(data)
      ElMessage.success('创建成功')
    } else {
      if (formData.value.password) {
        data.password = formData.value.password
      }
      await updateAdminUsers(formData.value.id, data)
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error('操作失败:', error)
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

onMounted(() => {
  fetchData()
  fetchRoles()
})
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>管理员列表</span>
          <el-button type="primary" @click="handleAdd" v-if="userStore.hasPermission('adminUsers:add')">新增管理员</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="phone" label="手机号" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            {{ row.role || '未分配' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)" v-if="userStore.hasPermission('adminUsers:edit')">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)" v-if="userStore.hasPermission('adminUsers:delete')">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="用户名" v-if="!formData.id">
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="formData.role_id" placeholder="请选择角色" style="width: 100%">
            <el-option
              v-for="role in rolesList"
              :key="role.id"
              :label="role.name"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="formData.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="formData.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="formData.password" type="password" placeholder="请输入密码，不填则不修改" show-password />
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
