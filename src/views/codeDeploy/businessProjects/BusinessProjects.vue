<!--
  业务项目(资产)管理 - 只读视图 + 资产路径管理

  设计:
  - 列表(只读)
  - 同步按钮: 触发 jumpserver 同步脚本(项目+资产)
  - 点击"详情"按钮 → 抽屉展示该项目下的资产列表
  - 每个资产行有"添加路径"按钮 → 弹窗,输入路径名称+路径
  - 每个资产行下面展示已绑定的路径(可删除)
  - 后端: /api/codeDeploy/projects/* + /api/codeDeploy/assets/:id/paths
  - 本模块只配置路径,不实际执行 SSH 命令(生产 JMS 禁命令)
-->
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Refresh } from '@element-plus/icons-vue'
import {
  getProjects,
  syncAll,
  getProjectAssets,
  getAssetPaths,
  addAssetPath,
  deleteAssetPath
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
// 每个 asset 的路径列表(键 = asset.id)
const pathsByAsset = ref({})
const pathsLoading = ref({})

// 添加路径弹窗
const pathDialogVisible = ref(false)
const pathDialogAsset = ref(null) // 当前操作的 asset
const pathForm = ref({ name: '', path: '', sort: 0 })
const pathSubmitting = ref(false)

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
          openDrawer({ id: drawerProjectId.value, name: drawerTitle.value.replace('项目详情 - ', '') })
        }
      } catch (e) {
        console.error('同步失败:', e)
      } finally {
        syncingProjects.value = false
      }
    })
    .catch(() => {})
}

const openDrawer = async (row) => {
  drawerTitle.value = `项目详情 - ${row.name}`
  drawerProjectId.value = row.id
  drawerVisible.value = true
  drawerLoading.value = true
  try {
    const res = await getProjectAssets(row.id)
    drawerAssets.value = res.data.list || []
    // 自动加载每个 asset 的路径
    drawerAssets.value.forEach(a => loadPaths(a.id))
  } catch (e) {
    console.error('加载项目资产失败:', e)
  } finally {
    drawerLoading.value = false
  }
}

const loadPaths = async (assetId) => {
  pathsLoading.value[assetId] = true
  try {
    const res = await getAssetPaths(assetId)
    pathsByAsset.value[assetId] = res.data.list || []
  } catch (e) {
    console.error('加载路径失败:', e)
  } finally {
    pathsLoading.value[assetId] = false
  }
}

const openPathDialog = (asset) => {
  pathDialogAsset.value = asset
  pathForm.value = { name: '', path: '', sort: 0 }
  pathDialogVisible.value = true
}

const submitPath = async () => {
  if (!pathForm.value.name || !pathForm.value.path) {
    ElMessage.warning('请填写路径名称和路径')
    return
  }
  pathSubmitting.value = true
  try {
    await addAssetPath(pathDialogAsset.value.id, {
      name: pathForm.value.name,
      path: pathForm.value.path,
      sort: pathForm.value.sort || 0
    })
    ElMessage.success('路径已添加')
    pathDialogVisible.value = false
    await loadPaths(pathDialogAsset.value.id)
  } catch (e) {
    console.error('添加路径失败:', e)
  } finally {
    pathSubmitting.value = false
  }
}

const handleDeletePath = (path) => {
  ElMessageBox.confirm(
    `确定删除路径"${path.name}"(${path.path})?`,
    '提示',
    { type: 'warning' }
  )
    .then(async () => {
      try {
        await deleteAssetPath(path.id)
        ElMessage.success('路径已删除')
        await loadPaths(path.asset_id)
      } catch (e) {
        console.error('删除路径失败:', e)
      }
    })
    .catch(() => {})
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

      <el-table :data="list" v-loading="loading" stripe>
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

    <!-- 详情抽屉:资产 + 路径 -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      direction="rtl"
      size="80%"
    >
      <div class="drawer-body">
        <el-alert title="服务器资产列表" type="info" :closable="false" show-icon>
          <template #default>
            从 JumpServer 拉取的资产(按 nodes[0] 归属当前项目)。
            每个资产可绑定多个 Linux 目录路径(给后续 SSH 任务用),路径只描述意图,不实际执行命令。
          </template>
        </el-alert>

        <el-table
          :data="drawerAssets"
          v-loading="drawerLoading"
          stripe
          row-key="id"
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

          <!-- 路径子表(每个资产下展开) -->
          <el-table-column type="expand" width="50">
            <template #default="{ row }">
              <div class="paths-block">
                <div class="paths-header">
                  <span class="paths-title">路径配置</span>
                  <el-button
                    size="small" type="primary" :icon="Plus"
                    @click="openPathDialog(row)"
                    v-if="userStore.hasRoute('POST', '/api/codeDeploy/assets/:id/paths')"
                  >添加路径</el-button>
                </div>
                <el-table
                  v-if="pathsByAsset[row.id] && pathsByAsset[row.id].length > 0"
                  :data="pathsByAsset[row.id]"
                  v-loading="pathsLoading[row.id]"
                  size="small"
                  border
                  style="margin-top: 8px;"
                >
                  <el-table-column prop="id" label="ID" width="60" />
                  <el-table-column prop="name" label="路径名称" min-width="160" />
                  <el-table-column prop="path" label="路径" min-width="260" show-overflow-tooltip />
                  <el-table-column prop="sort" label="排序" width="80" />
                  <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row: p }">
                      <el-button
                        size="small" link type="danger" :icon="Delete"
                        @click="handleDeletePath(p)"
                        v-if="userStore.hasRoute('DELETE', '/api/codeDeploy/assets/paths/:id')"
                      >删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty
                  v-else-if="!pathsLoading[row.id]"
                  :image-size="60"
                  description="尚未配置路径"
                />
              </div>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!drawerLoading && drawerAssets.length === 0" description="该项目下暂无资产,请先同步资产" />
      </div>
    </el-drawer>

    <!-- 添加路径弹窗 -->
    <el-dialog v-model="pathDialogVisible" title="添加路径" width="500px">
      <el-form :model="pathForm" label-width="100px">
        <el-form-item label="路径名称" required>
          <el-input v-model="pathForm.name" placeholder="例:前端web目录" />
        </el-form-item>
        <el-form-item label="路径" required>
          <el-input v-model="pathForm.path" placeholder="例:/home/www/web" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="pathForm.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item>
          <el-alert type="info" :closable="false" show-icon>
            <template #default>
              路径只描述"在哪个目录跑命令"的意图,本系统<strong>不会自动执行</strong>任何 SSH 操作。
            </template>
          </el-alert>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pathDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pathSubmitting" @click="submitPath">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.drawer-body { padding: 16px; }
.paths-block { padding: 0 16px 16px 32px; }
.paths-header { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.paths-title { font-weight: 500; color: #303133; }
</style>
