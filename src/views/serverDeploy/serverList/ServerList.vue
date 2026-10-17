<!--
  云服务器列表(2026-10-17 新增)
  - 数据源:由 CloudCredential 一栏"同步服务器"按钮触发 → 阿里云 API 拉取 → DB 持久化
  - 表内筛选:厂商(aliyun / tencent 留空=全部)、凭证、区域、关键字(name / instance_id / 内网 IP / 公网 IP)
  - 同步状态提示横幅
  - 此页也能直接点"立即同步"按钮(同步所有 aliyun 凭证,跨 region 串完需要 12~30s)
-->
<template>
  <div class="server-list-page">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <div class="header-left">
            <el-radio-group v-model="filter.vendor" @change="onFilterChange">
              <el-radio-button value="">全部</el-radio-button>
              <el-radio-button value="aliyun">阿里云</el-radio-button>
              <el-radio-button value="tencent">腾讯云</el-radio-button>
            </el-radio-group>
            <el-select
              v-model="filter.credential_id"
              placeholder="所有凭证"
              style="width: 200px;"
              clearable
              @change="onFilterChange"
              @clear="onFilterChange"
            >
              <el-option
                v-for="c in credentialOptions"
                :key="c.id"
                :label="`${c.name} (${c.type === 'aliyun' ? '阿里云' : '腾讯云'})`"
                :value="c.id"
              />
            </el-select>
            <el-select
              v-model="filter.region"
              placeholder="所有区域"
              style="width: 180px;"
              filterable
              clearable
              @change="onFilterChange"
              @clear="onFilterChange"
            >
              <el-option v-for="r in regionOptions" :key="r" :label="r" :value="r" />
            </el-select>
            <el-input
              v-model="filter.keyword"
              placeholder="搜索 名称 / 实例 ID / IP"
              style="width: 240px;"
              clearable
              @keyup.enter="onFilterChange"
              @clear="onFilterChange"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :icon="Search" @click="onFilterChange">搜索</el-button>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="loadList">刷新</el-button>
            <el-button
              type="warning"
              :icon="Refresh"
              :loading="syncing"
              @click="onSyncAll"
            >立即同步全部</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="syncStatus.last_at > 0"
        type="info"
        :closable="false"
        show-icon
        :title="`最近同步: ${formatTime(syncStatus.last_at)} · 共 ${syncStatus.last_count} 台服务器`"
      />

      <el-alert
        v-if="!hasData && syncStatus.last_at === 0"
        type="warning"
        :closable="false"
        show-icon
        title="暂无服务器数据"
        :description="alertEmptyDesc"
      />

      <el-table
        v-loading="loading"
        :data="pagedList"
        border
        stripe
        size="small"
        empty-text="没有匹配的服务器"
      >
        <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="name-cell">{{ row.name || row.instance_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="instance_id" label="实例 ID" min-width="180" show-overflow-tooltip />
        <el-table-column label="厂商" width="100">
          <template #default="{ row }">
            <el-tag :type="row.vendor === 'aliyun' ? 'warning' : 'success'" size="small">
              {{ row.vendor === 'aliyun' ? '阿里云' : row.vendor === 'tencent' ? '腾讯云' : (row.vendor || '-') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="region" label="区域" min-width="140" show-overflow-tooltip />
        <el-table-column prop="zone" label="可用区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.zone || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ row.status || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="instance_type" label="规格" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.instance_type || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="CPU/内存" width="120">
          <template #default="{ row }">
            <span v-if="row.cpu || row.memory_gb">{{ row.cpu }}C / {{ row.memory_gb }}G</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="private_ip" label="内网 IP" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="ip-cell">{{ row.private_ip || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="public_ip" label="公网 IP" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="ip-cell">{{ row.public_ip || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="os_name" label="系统" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.os_name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="instance_created_at" label="创建时间" width="170">
          <template #default="{ row }">
            <span>{{ formatAliyunTime(row.instance_created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="expired_at" label="到期时间" width="170">
          <template #default="{ row }">
            <span>{{ formatAliyunTime(row.expired_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="snapshot_at" label="同步时间" width="170">
          <template #default="{ row }">
            <span>{{ formatAliyunTime(row.snapshot_at) }}</span>
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
          @size-change="onPageChange"
          @current-change="onPageChange"
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
  listServers, syncServers, getServerSyncStatus,
  listCredentials
} from '@/api/serverDeploy'

const list = ref([])
const loading = ref(false)
const syncing = ref(false)
const hasData = ref(false)
const syncStatus = reactive({ running: false, last_at: 0, last_count: 0, last_error: '' })
const credentialOptions = ref([])
const regionOptions = ref([])

// 空状态描述(放在 data 里,避免在 el-alert description 属性里写嵌套双引号)
const alertEmptyDesc = '请到「云平台凭证」页面点击凭证行 [同步服务器],或在此页点 [立即同步全部] (目前仅支持阿里云)'

const filter = reactive({
  vendor: '',     // 空 = 全部 / aliyun / tencent
  credential_id: '', // 数字 / 空 = 全部
  region: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const pagedList = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  return list.value.slice(start, start + pagination.size)
})

function statusTag(s) {
  if (s === 'Running') return 'success'
  if (s === 'Stopped') return 'info'
  if (s === 'Starting' || s === 'Stopping') return 'warning'
  return ''
}

function formatTime(unix) {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleString('zh-CN')
}

function formatAliyunTime(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function loadCredentials() {
  try {
    const r = await listCredentials({})  // 不过滤,拿所有凭证(只取 mask 后的也行,这里只显示 name)
    credentialOptions.value = (r.data && r.data.list) || []
  } catch {
    // 凭证列表失败不影响服务器列表
  }
}

async function loadList() {
  loading.value = true
  try {
    const r = await listServers({
      vendor: filter.vendor,
      credential_id: filter.credential_id,
      region: filter.region,
      keyword: filter.keyword
    })
    list.value = (r.data && r.data.list) || []
    pagination.total = (r.data && r.data.total) || 0
    hasData.value = pagination.total > 0
    // 提取 region 下拉选项
    const set = new Set()
    for (const it of list.value) {
      if (it.region) set.add(it.region)
    }
    regionOptions.value = Array.from(set).sort()
  } catch (e) {
    list.value = []
    pagination.total = 0
    ElMessage.error('加载服务器列表失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  } finally {
    loading.value = false
  }
}

async function loadSyncStatus() {
  try {
    const r = await getServerSyncStatus()
    Object.assign(syncStatus, r.data || {})
  } catch {
    // 忽略
  }
}

function onFilterChange() {
  pagination.page = 1
  loadList()
}

function onPageChange() {
  // page/size 变化已通过 v-model 同步,只重切数据即可
}

async function onSyncAll() {
  syncing.value = true
  try {
    const r = await syncServers()
    if (r.code === 0) {
      ElMessage.success(`同步完成,共 ${r.data.count} 台服务器`)
    } else {
      ElMessage.error('同步失败: ' + (r.msg || ''))
    }
    await loadSyncStatus()
    pagination.page = 1
    await loadList()
  } catch {
    // 拦截器已弹错
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  await loadCredentials()
  await loadSyncStatus()
  await loadList()
})
</script>

<style scoped>
.server-list-page { padding: 16px; }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.header-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.header-right { display: flex; gap: 8px; align-items: center; }
.name-cell { font-weight: 500; }
.ip-cell { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 12px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.el-alert { margin-bottom: 12px; }
</style>
