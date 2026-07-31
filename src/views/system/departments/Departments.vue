<!--
  部门管理(简单 CRUD 页面)

  用途:给"数据范围权限"的"看部门"用
  一个用户属于一个部门,部门是树形
-->
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDepartments } from '@/api/system/departments'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const list = ref([])
const loading = ref(false)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getDepartments()
    list.value = res.data || []
  } catch (e) {
    console.error('获取部门失败:', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>部门列表</span>
          <el-tag v-if="userStore.hasPermission('departments:add')" type="info" size="small">
            部门 CRUD 暂未实现,先用列表展示
          </el-tag>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="部门名称" min-width="200" />
        <el-table-column prop="parent_id" label="上级部门" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.parent_id === 0" type="success" size="small">顶级</el-tag>
            <span v-else>{{ row.parent_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
