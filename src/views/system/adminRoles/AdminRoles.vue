<!--
  角色管理(只角色 CRUD)

  设计:
  - 纯角色列表 + 增删改查
  - 数据范围(0=全部/1=部门/2=自己)在编辑对话框里选
  - 选角色后,把 roleId 存到 Pinia,跳转"权限分配"页
-->
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAdminRolesList,
  createAdminRoles,
  updateAdminRoles,
  deleteAdminRoles
} from '@/api/system/adminRoles'
import { useUserStore } from '@/stores/user'
import { useRoleSelectionStore } from '@/stores/roleSelection'

const userStore = useUserStore()
const roleSelectionStore = useRoleSelectionStore()
const router = useRouter()

const list = ref([])
const loading = ref(false)
const pagination = ref({ page: 1, size: 10, total: 0 })

const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const form = ref({ id: 0, name: '', describe: '', status: 1, data_scope: 0 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getAdminRolesList({
      page: pagination.value.page,
      size: pagination.value.size
    })
    list.value = res.data.list
    pagination.value.total = res.data.total
  } catch (e) {
    console.error('获取角色失败:', e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  form.value = { id: 0, name: '', describe: '', status: 1, data_scope: 0 }
  dialogTitle.value = '新增角色'
  dialogVisible.value = true
}

const openEdit = (row) => {
  form.value = {
    id: row.id,
    name: row.name,
    describe: row.describe || '',
    status: row.status,
    data_scope: row.data_scope ?? 0
  }
  dialogTitle.value = '编辑角色'
  dialogVisible.value = true
}

const submit = async () => {
  if (!form.value.name) {
    ElMessage.warning('请输入角色名')
    return
  }
  try {
    if (form.value.id === 0) {
      await createAdminRoles({
        name: form.value.name,
        describe: form.value.describe,
        status: form.value.status,
        data_scope: form.value.data_scope
      })
      ElMessage.success('创建成功')
    } else {
      await updateAdminRoles(form.value.id, {
        name: form.value.name,
        describe: form.value.describe,
        status: form.value.status,
        data_scope: form.value.data_scope
      })
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    console.error('保存失败:', e)
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定删除角色"${row.name}"?`, '提示', { type: 'warning' })
    .then(async () => {
      try {
        await deleteAdminRoles(row.id)
        ElMessage.success('删除成功')
        fetchData()
      } catch (e) {
        console.error('删除失败:', e)
      }
    })
    .catch(() => {})
}

// 跳到"权限分配"页
const goAssign = (row) => {
  roleSelectionStore.setSelectedRoleId(row.id)
  router.push('/system/roleMenu')
}

onMounted(fetchData)
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>角色列表</span>
          <el-button
            type="primary" size="small" @click="openCreate"
            v-if="userStore.hasPermission('adminRoles:add')"
          >+ 新增角色</el-button>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="describe" label="描述" min-width="120" show-overflow-tooltip />
        <el-table-column label="数据范围" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.data_scope === 0 ? 'success' : (row.data_scope === 1 ? 'warning' : 'info')">
              {{ ['全部', '部门', '自己'][row.data_scope] || '全部' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="goAssign(row)"
              v-if="userStore.hasPermission('roleMenu:view')"
            >分配权限</el-button>
            <el-button size="small" link type="primary" @click="openEdit(row)"
              v-if="userStore.hasPermission('adminRoles:edit')"
            >编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)"
              v-if="userStore.hasPermission('adminRoles:delete')"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="fetchData"
        @size-change="fetchData"
        style="margin-top: 16px; justify-content: flex-end;"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="角色名" required>
          <el-input v-model="form.name" placeholder="例如:测试员" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.describe" placeholder="角色用途说明" />
        </el-form-item>
        <el-form-item label="数据范围">
          <el-radio-group v-model="form.data_scope">
            <el-radio :value="0">看全部</el-radio>
            <el-radio :value="1">看部门</el-radio>
            <el-radio :value="2">看自己</el-radio>
          </el-radio-group>
          <div class="form-tip">决定该角色能查询的数据范围</div>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.form-tip { font-size: 12px; color: #999; margin-top: 4px; }
</style>
