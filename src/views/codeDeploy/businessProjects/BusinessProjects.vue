<!--
  业务项目(资产)管理 - 只读视图

  设计:
  - 列表(只读)
  - 同步按钮: 触发 jumpserver 同步脚本(项目+资产)
  - 点击行 或 详情按钮 → 抽屉展示该项目下的资产列表
  - 后端: /api/codeDeploy/projects/* + /api/codeDeploy/projects/:id/assets
-->
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import {
  getProjects,
  syncAll,
  getProjectAssets
} from '@/api/codeDeploy'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const list = ref([])
const loading = ref(false)
const syncingProjects = ref(false)
const pagination = ref({ page: 1, size: 10, total: 0 })

// 详情抽屉
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const drawerTitle = ref('')
const drawerProjectId = ref(0)
const drawerAssets = ref([])

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getProjects()
    const all = res.data.list || []
    pagination.value.total = all.length
    const start = (pagination.value.page - 1) * pagination.value.size
    list.value = all.slice(start, start + pagination.value.size)
  } catch (e) {
    console.error('获取资产列表失败:', e)
  } finally {
    loading.value = false
  }
}

// 同步项目+资产(从 JMS 拉)
const handleSync = () => {
  ElMessageBox.confirm(
    '将从 JumpServer 同步: 业务项目(节点树) → 业务资产(按项目归属,Linux only),顺序执行,是否继续?',
    '同步资产',
    { type: 'warning' }
  )
    .then(async () => {
      syncingProjects.value = true
      try {
        const res = await syncAll()
        const { projects, assets, project_err, asset_err } = res.data || {}
        const pMsg = projects
          ? `项目: 新增 ${projects.added}, 更新 ${projects.updated}, 软删 ${projects.removed}`
          : `项目: 失败 (${project_err || '未知'})`
        const aMsg = assets
          ? `资产: 新增 ${assets.added}, 更新 ${assets.updated}, 软删 ${assets.removed}`
          : `资产: 失败 (${asset_err || '未知'})`
        ElMessage.success(`同步完成 - ${pMsg}; ${aMsg}`)
        fetchData()
        if (drawerVisible.value) {
          loadDrawerAssets()
        }
      } catch (e) {
        console.error('同步失败:', e)
      } finally {
        syncingProjects.value = false
      }
    })
    .catch(() => {})
}

// 打开详情抽屉(行点击 / 详情按钮共用)
const openDrawer = async (row) => {
  drawerTitle.value = `项目详情 - ${row.name}`
  drawerProjectId.value = row.id
  drawerVisible.value = true
  await loadDrawerAssets()
}

const loadDrawerAssets = async () => {
  if (!drawerProjectId.value) return
  drawerLoading.value = true
  try {
    const res = await getProjectAssets(drawerProjectId.value)
    drawerAssets.value = res.data.list || []
  } catch (e) {
    console.error('加载项目资产失败:', e)
  } finally {
    drawerLoading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>资产(业务项目)列表</span>
          <div>
            <el-button
              :icon="Refresh" :loading="syncingProjects" @click="handleSync"
              v-if="userStore.hasRoute('POST', '/api/codeDeploy/sync')"
            >同步资产</el-button>
          </div>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe style="cursor: pointer;">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="code" label="编码(机器名)" min-width="180" show-overflow-tooltip />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="60" />
        <el-table-column prop="created_at" label="创建时间" min-width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDrawer(row)"
              v-if="userStore.hasRoute('GET', '/api/codeDeploy/projects/:id/assets')"
            >详情</el-button>
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

    <!-- 详情抽屉(详情按钮 / 行点击 都会打开) -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      direction="rtl"
      size="70%"
    >
      <div class="drawer-body">
        <div class="drawer-tip">
          <el-alert
            title="服务器资产列表"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              从 JumpServer 拉取的资产(按 nodes[0] 归属当前项目)。修改名称/平台/协议请去 JMS。
            </template>
          </el-alert>
        </div>
        <el-table
          :data="drawerAssets"
          v-loading="drawerLoading"
          stripe
          style="width: 100%; margin-top: 16px;"
        >
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="address" label="IP/域名" min-width="140" />
          <el-table-column prop="platform" label="平台" width="100" />
          <el-table-column prop="os" label="OS" width="100" />
          <el-table-column label="协议" width="100">
            <template #default="{ row }">
              {{ row.protocol }}<span v-if="row.port">:{{ row.port }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="comment" label="备注" min-width="140" show-overflow-tooltip />
        </el-table>
        <el-empty v-if="!drawerLoading && drawerAssets.length === 0" description="该项目下暂无资产,请先同步资产" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.drawer-body { padding: 16px; }
.drawer-tip { margin-bottom: 8px; }
</style>
