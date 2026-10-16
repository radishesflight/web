<!--
  部署日志 页面(2026-10-16 新增)

  布局:
    顶部:筛选栏(event 类型 / result 成功失败 / 包名模糊 / 时间范围 + 刷新)
    中部:日志列表(分页)
    右侧:点击行打开抽屉,显示完整字段 + 远端 stdout/stderr

  数据来源:
    GET  /api/codeDeploy/operation-logs  分页 + 筛选
    GET  /api/codeDeploy/operation-logs/:id  详情

  权限:菜单挂在 codeDeploy(menu_id=8)下,菜单 code=operationLog,
       op 105(GET list) + 106(GET detail),超管默认有。
-->
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { getOperationLogs, getOperationLog } from '@/api/codeDeploy'

// 事件类型选项(跟后端 service/operation_log.go 常量一致)
const EVENT_OPTIONS = [
  { value: '', label: '全部事件' },
  { value: 'deploy', label: '部署' },
  { value: 'upload', label: '上传' },
  { value: 'delete', label: '删除' },
  { value: 'download', label: '下载' },
  { value: 'project.sync', label: '同步项目' },
  { value: 'asset.sync', label: '同步资产' },
  { value: 'sync.all', label: '一键同步' }
]

// 筛选
const filterEvent = ref('')
const filterResult = ref('')   // '' = 全部, 1 = 成功, 0 = 失败
const filterKeyword = ref('')
const filterStart = ref('')     // 'YYYY-MM-DD'
const filterEnd = ref('')

// 列表
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)

// 抽屉
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const drawerData = ref(null)

async function loadList() {
  loading.value = true
  try {
    const params = {
      event: filterEvent.value || undefined,
      result: filterResult.value !== '' ? Number(filterResult.value) : undefined,
      keyword: filterKeyword.value || undefined,
      start: filterStart.value || undefined,
      end: filterEnd.value || undefined,
      page: page.value,
      size: size.value
    }
    const { data } = await getOperationLogs(params)
    list.value = data.list || []
    total.value = data.total || 0
  } catch (e) {
    console.error('[OperationLog] load failed:', e)
    ElMessage.error('加载日志失败: ' + (e?.msg || e?.message || '网络异常'))
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function openDetail(row) {
  drawerVisible.value = true
  drawerLoading.value = true
  drawerData.value = null
  try {
    const { data } = await getOperationLog(row.id)
    drawerData.value = data
  } catch (e) {
    ElMessage.error('加载详情失败: ' + (e?.msg || e?.message || '网络异常'))
    drawerVisible.value = false
  } finally {
    drawerLoading.value = false
  }
}

function eventLabel(ev) {
  const o = EVENT_OPTIONS.find(x => x.value === ev)
  return o ? o.label : ev
}

function resultTagType(r) {
  return r === 1 ? 'success' : 'danger'
}
function resultText(r) {
  return r === 1 ? '成功' : '失败'
}

function formatDuration(ms) {
  if (!ms) return '-'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(2) + 's'
}

function onPageChange(p) {
  page.value = p
  loadList()
}
function onSizeChange(s) {
  size.value = s
  page.value = 1
  loadList()
}

function resetFilter() {
  filterEvent.value = ''
  filterResult.value = ''
  filterKeyword.value = ''
  filterStart.value = ''
  filterEnd.value = ''
  page.value = 1
  loadList()
}

onMounted(loadList)
</script>

<template>
  <div class="operation-log-page">
    <!-- 顶部筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" size="small" class="filter-form">
        <el-form-item label="事件">
          <el-select v-model="filterEvent" placeholder="全部事件" clearable style="width: 140px;">
            <el-option v-for="o in EVENT_OPTIONS" :key="o.value || 'all'" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="filterResult" placeholder="全部" clearable style="width: 110px;">
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="包名/用户">
          <el-input v-model="filterKeyword" placeholder="模糊搜索" clearable style="width: 200px;" />
        </el-form-item>
        <el-form-item label="开始">
          <el-date-picker v-model="filterStart" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width: 150px;" />
        </el-form-item>
        <el-form-item label="结束">
          <el-date-picker v-model="filterEnd" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width: 150px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="() => { page = 1; loadList() }">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never" class="list-card">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        size="small"
        empty-text="暂无日志"
        @row-click="openDetail"
        class="log-table"
        style="cursor: pointer;"
      >
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="event" label="事件" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ eventLabel(row.event) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="resultTagType(row.result)" size="small">{{ resultText(row.result) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="操作人" width="120" show-overflow-tooltip />
        <el-table-column prop="target_name" label="目标" min-width="200" show-overflow-tooltip />
        <el-table-column prop="jms_asset_name" label="目标资产" width="160" show-overflow-tooltip />
        <el-table-column prop="duration_ms" label="耗时" width="100">
          <template #default="{ row }">{{ formatDuration(row.duration_ms) }}</template>
        </el-table-column>
        <el-table-column prop="client_ip" label="客户端" width="140" show-overflow-tooltip />
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="onPageChange"
        @size-change="onSizeChange"
        class="pager"
      />
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="日志详情" size="60%" direction="rtl">
      <div v-loading="drawerLoading" class="detail-wrap">
        <template v-if="drawerData">
          <el-descriptions :column="2" border size="small" class="detail-desc">
            <el-descriptions-item label="ID">{{ drawerData.id }}</el-descriptions-item>
            <el-descriptions-item label="事件">
              <el-tag size="small">{{ eventLabel(drawerData.event) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="结果">
              <el-tag :type="resultTagType(drawerData.result)" size="small">{{ resultText(drawerData.result) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="HTTP">{{ drawerData.method }} {{ drawerData.path }}</el-descriptions-item>
            <el-descriptions-item label="操作人">{{ drawerData.username || '-' }} (ID: {{ drawerData.user_id || '-' }})</el-descriptions-item>
            <el-descriptions-item label="客户端 IP">{{ drawerData.client_ip || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标类型">{{ drawerData.target_type }}</el-descriptions-item>
            <el-descriptions-item label="目标 ID">{{ drawerData.target_id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标名" :span="2">
              <code>{{ drawerData.target_name }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ drawerData.started_at }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ drawerData.finished_at || '-' }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{ formatDuration(drawerData.duration_ms) }}</el-descriptions-item>
            <el-descriptions-item label="记录时间">{{ drawerData.created_at }}</el-descriptions-item>
            <el-descriptions-item v-if="drawerData.jms_task_id" label="JMS Task ID" :span="2">
              <code>{{ drawerData.jms_task_id }}</code>
            </el-descriptions-item>
            <el-descriptions-item v-if="drawerData.jms_asset_name" label="JMS 资产" :span="2">
              {{ drawerData.jms_asset_name }}
            </el-descriptions-item>
            <el-descriptions-item v-if="drawerData.error_msg" label="错误" :span="2">
              <span class="err-text">{{ drawerData.error_msg }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="drawerData.user_agent" label="User-Agent" :span="2">
              <small>{{ drawerData.user_agent }}</small>
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="drawerData.jms_output" class="output-block">
            <h4>远端输出(末 2000 字符,stderr 优先)</h4>
            <pre class="output-text">{{ drawerData.jms_output }}</pre>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.operation-log-page { padding: 16px; }
.filter-card { margin-bottom: 12px; }
.filter-form { margin-bottom: -18px; }
.list-card { margin-bottom: 12px; }
.log-table :deep(td) { vertical-align: middle; }
.pager { margin-top: 14px; text-align: right; }
.detail-wrap { padding: 0 8px; }
.detail-desc { margin-bottom: 16px; }
.err-text { color: #f56c6c; word-break: break-all; }
.output-block h4 {
  margin: 16px 0 8px;
  font-size: 14px;
  color: var(--el-color-info);
}
.output-text {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 480px;
  overflow-y: auto;
}
code {
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
</style>
