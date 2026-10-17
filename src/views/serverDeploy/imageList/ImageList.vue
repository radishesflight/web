<!--
  镜像列表 页面(2026-10-17 改造为从 DB 读)

  数据流:点"重新同步" → 后端拉阿里云 → 删旧 → 插新 → 列表查 DB(毫秒级)

  接口:
    GET   /api/serverDeploy/images             列镜像(支持 region/type/keyword 过滤)
    POST  /api/serverDeploy/images/sync        触发同步
    GET   /api/serverDeploy/images/sync/status 同步状态
-->
<template>
  <div class="image-list-page">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <div class="header-left">
            <el-radio-group v-model="filter.type" @change="onFilterChange">
              <el-radio-button value="">全部</el-radio-button>
              <el-radio-button value="Self">自定义</el-radio-button>
              <el-radio-button value="Others">共享</el-radio-button>
            </el-radio-group>
            <el-select
              v-model="filter.region"
              placeholder="全部区域"
              style="width: 200px;"
              filterable
              clearable
              @change="onFilterChange"
              @clear="onFilterChange"
            >
              <el-option
                v-for="r in regions"
                :key="r.RegionId"
                :label="r.RegionId"
                :value="r.RegionId"
              />
            </el-select>
            <el-input
              v-model="filter.keyword"
              placeholder="搜索镜像 ID / 名称"
              style="width: 220px;"
              clearable
              @keyup.enter="onFilterChange"
              @clear="onFilterChange"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :icon="Search" @click="loadImages">搜索</el-button>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="loadImages">刷新</el-button>
            <el-button type="warning" plain :icon="Refresh" :loading="syncing" @click="onSync">重新同步</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="!hasData"
        type="warning"
        :closable="false"
        show-icon
        title="暂无镜像数据"
        description='请先点击右上角"重新同步"按钮(约 12 秒,会拉取阿里云所有 region 的自定义/共享镜像)'
      />

      <el-alert
        v-else-if="syncStatus.last_at > 0"
        type="info"
        :closable="false"
        show-icon
        :title="`最近同步: ${formatTime(syncStatus.last_at)} · 共 ${syncStatus.last_count} 个镜像`"
      />

      <el-table
        v-loading="loading"
        :data="pagedImages"
        border
        stripe
        size="small"
        empty-text="没有匹配的镜像"
      >
        <el-table-column label="类型" width="90" fixed="left">
          <template #default="{ row }">
            <el-tag v-if="row.image_type === 'Self'" type="success" size="small">自定义</el-tag>
            <el-tag v-else-if="row.image_type === 'Others'" type="warning" size="small">共享</el-tag>
            <el-tag v-else size="small">{{ row.image_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="image_id" label="镜像 ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="image_name" label="镜像名" min-width="240" show-overflow-tooltip />
        <el-table-column prop="region_id" label="Region" width="140" />
        <el-table-column prop="image_owner_alias" label="Owner" width="100" />
        <el-table-column prop="os_name" label="系统" min-width="180" show-overflow-tooltip />
        <el-table-column prop="architecture" label="架构" width="80" />
        <el-table-column prop="size_gb" label="大小(GB)" width="100" align="right" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="image_created_at" label="镜像创建时间" width="170">
          <template #default="{ row }">
            <span>{{ formatAliyunTime(row.image_created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="snapshot_at" label="同步时间" width="170">
          <template #default="{ row }">
            <span>{{ formatAliyunTime(row.snapshot_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              disabled
            >复制/共享(暂未接通)</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadImages"
          @current-change="loadImages"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import {
  listRegions,
  listImages,
  syncImages,
  getSyncStatus
} from '@/api/serverDeploy'

const regions = ref([])
const allImages = ref([])  // DB 查到的全部镜像(前端做筛选 + 分页)
const loading = ref(false)
const syncing = ref(false)
const hasData = ref(false)
const syncStatus = reactive({ running: false, last_at: 0, last_count: 0, last_error: '' })

const filter = reactive({
  type: '',      // 空=全部 / Self / Others
  region: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 服务端已经按筛选条件返回了,前端不再做前端过滤,直接分页
const pagedImages = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  return allImages.value.slice(start, start + pagination.size)
})

function statusTag(s) {
  if (s === 'Available') return 'success'
  if (s === 'Creating') return 'warning'
  if (s === 'Deprecated') return 'info'
  return ''
}

function formatTime(unix) {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleString('zh-CN')
}

// 阿里云时间字段是 ISO/RFC3339 字符串,前端 new Date 解析后用本地时区展示
// 容错:解析失败时回退原字符串
function formatAliyunTime(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function loadRegions() {
  try {
    const r = await listRegions()
    regions.value = (r.data && r.data.list) || []
  } catch (e) {
    ElMessage.error('加载 region 失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  }
}

async function loadImages() {
  loading.value = true
  try {
    const r = await listImages({
      type: filter.type,
      region: filter.region,
      keyword: filter.keyword,
      page: pagination.page,
      size: pagination.size
    })
    allImages.value = (r.data && r.data.list) || []
    pagination.total = (r.data && r.data.total) || 0
    hasData.value = pagination.total > 0 || syncStatus.last_count > 0
  } catch (e) {
    allImages.value = []
    pagination.total = 0
    ElMessage.error('加载镜像失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  } finally {
    loading.value = false
  }
}

async function loadSyncStatus() {
  try {
    // 直接调用函数(旧写法 .then(m => m.getSyncStatus()) 拿到的是 Promise 对象本身,
    //   后边 r.data 永远是 undefined;修 2026-10-17 清理审计)
    const r = await getSyncStatus()
    Object.assign(syncStatus, r.data || {})
    if (syncStatus.last_count > 0) hasData.value = true
  } catch (e) {
    // 忽略
  }
}

function onFilterChange() {
  pagination.page = 1
  loadImages()
}

// 触发同步:删旧 + 拉阿里云 + 插新(12 秒左右,期间按钮显示 loading)
async function onSync() {
  syncing.value = true
  try {
    const r = await syncImages()
    if (r.code === 0) {
      ElMessage.success(`同步完成,共 ${r.data.count} 个镜像,耗时 ${(r.data.elapsed_ms / 1000).toFixed(1)}s`)
    } else {
      ElMessage.error('同步失败: ' + (r.msg || ''))
    }
    await loadSyncStatus()
    pagination.page = 1
    await loadImages()
    await loadRegions()  // region 字典可能新增
  } catch (e) {
    ElMessage.error('同步失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  await loadRegions()
  await loadSyncStatus()
  await loadImages()
})
</script>

<style scoped>
.image-list-page { padding: 16px; }
.header-row { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; gap: 8px; align-items: center; }
.header-right { display: flex; gap: 8px; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
