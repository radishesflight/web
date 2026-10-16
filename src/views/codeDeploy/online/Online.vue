<!--
  后端 API 部署(2026-10-16 改造)
  原 Online.vue 是"代码包上传 + OSS 下载 + unzip"流程,
  改成走 git reset,直接拉远端仓库的指定分支 + composer install + chown。

  流程:
    1. 选资产(服务器)
    2. 选项目路径(目标机器上的 deploy dir,如 /data/www/web/ceshi)
    3. 输入 git 分支名(用户自己填,如 main / develop)
    4. 点"拉取代码"→ 后端调 JMS 跑完整 shell:
         cd {deploy_path}
         zip 备份(留最近 5 个)
         git fetch + git reset --hard origin/{branch}
         composer install
         chown -R www.www
       后端轮询 JMS 任务到终态后返回结果

  部署日志自动写 go_operation_log(Event=deploy, JMS 字段填齐)
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Promotion } from '@element-plus/icons-vue'
import { getAssets, getAssetPaths, gitDeploy } from '@/api/codeDeploy'

// ============== 状态 ==============
const loadingAssets = ref(false)
const filterText = ref('')
const selectedAsset = ref(null)        // {id, name, address, project_id, ...}

// 2. 选项目路径
const projectOptions = ref([])
const loadingProjects = ref(false)
const selectedProject = ref(null)       // {id, name, path}

// 拉取代码(走 git)— 分支后端自己拿(2026-10-16 v2)
const pulling = ref(false)
const result = ref(null)                // {type, text}

// 最近用过的资产(localStorage 持久化)
const RECENTS_KEY = 'codeDeploy.recents'
const RECENTS_MAX = 10
const recentAssetIDs = ref([])

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (raw) recentAssetIDs.value = JSON.parse(raw)
  } catch { recentAssetIDs.value = [] }
}
function saveRecents() {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recentAssetIDs.value.slice(0, RECENTS_MAX)))
  } catch { /* 忽略 */ }
}
function pushRecent(id) {
  recentAssetIDs.value = [id, ...recentAssetIDs.value.filter(x => x !== id)].slice(0, RECENTS_MAX)
  saveRecents()
}

const recentSet = computed(() => new Set(recentAssetIDs.value))

const allAssetsList = ref([])

// ============== 计算属性 ==============
const recentAssets = computed(() => {
  const all = allAssetsList.value
  if (!all) return []
  // 把"最近用过"排到最前面,其余按原顺序
  const recents = recentAssetIDs.value
    .map(id => all.find(a => a.id === id))
    .filter(Boolean)
  const rest = all.filter(a => !recentSet.value.has(a.id))
  return [...recents, ...rest]
})

const filteredAssets = computed(() => {
  const list = recentAssets.value
  const q = filterText.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(a =>
    (a.name || '').toLowerCase().includes(q) ||
    (a.address || '').toLowerCase().includes(q)
  )
})

const canPull = computed(() =>
  !!(selectedAsset.value && selectedProject.value && !pulling.value)
)

// 2. 选项目路径的 placeholder
const projectPlaceholder = computed(() => {
  if (!selectedAsset.value) return '-- 请先选资产 --'
  if (loadingProjects.value) return '正在加载项目路径...'
  return '请选择要拉取的项目路径'
})

// ============== 加载 ==============
async function loadAssets() {
  loadingAssets.value = true
  try {
    const { data } = await getAssets()
    allAssetsList.value = data.list || []
  } catch (e) {
    console.error('[Online] loadAssets failed:', e)
    ElMessage.error('加载资产失败: ' + (e?.msg || e?.message || '网络异常'))
    allAssetsList.value = []
  } finally {
    loadingAssets.value = false
  }
}

async function loadProjects(asset) {
  loadingProjects.value = true
  projectOptions.value = []
  try {
    // 后端"后端 API 部署"菜单只展示 type=api 的路径(对应后端 PHP 项目)
    //   type=web 给 ApkPackage(前端包管理)用,这里不展示
    const { data } = await getAssetPaths(asset.id, 'api')
    const paths = data?.list || []
    // 转成 {id, name, path}
    projectOptions.value = paths.map(p => ({
      id: p.id,
      name: p.name || p.path,
      path: p.path
    }))
  } catch (e) {
    console.error('[Online] loadProjects failed:', e)
    ElMessage.error('加载项目路径失败: ' + (e?.msg || e?.message || '网络异常'))
    projectOptions.value = []
  } finally {
    loadingProjects.value = false
  }
}

// ============== 选中 ==============
function selectAsset(asset) {
  selectedAsset.value = asset
  selectedProject.value = null
  result.value = null
  loadProjects(asset)
}

function reselectAsset() {
  selectedAsset.value = null
  selectedProject.value = null
  projectOptions.value = []
  result.value = null
}

function onProjectChange(option) {
  if (!option) {
    selectedProject.value = null
    return
  }
  result.value = null
}

// ============== 拉取代码(走 git)==============
async function handlePull() {
  if (!canPull.value) {
    ElMessage.warning('请先选资产和项目路径')
    return
  }
  if (!selectedProject.value) {
    ElMessage.warning('请选择项目路径')
    return
  }
  // 二次确认
  try {
    await ElMessageBox.confirm(
      `确认对资产 "${selectedAsset.value.name}" 部署?(服务器当前 git 分支,以服务器为准:git symbolic-ref --short HEAD)这会通过 JMS 拉起 ad-hoc 任务(备份 → git reset → composer install → chown),约 1-3 分钟。`,
      '后端 API 部署',
      { confirmButtonText: '开始部署', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  pulling.value = true
  try {
    // path_id 必传,后端校验 type='api' 且 asset_id 匹配
    const { data: res } = await gitDeploy(
      selectedAsset.value.id,
      selectedProject.value.id
    )
    const timeCost = (res && res.time_cost) || 0
    const branch = (res && res.branch) || '?'
    if (res && res.success) {
      ElMessage.success('部署成功: branch=' + branch + ' (耗时 ' + timeCost.toFixed(2) + 's)')
      // 写入 recentAssetIDs(部署成功才记)
      if (selectedAsset.value) pushRecent(selectedAsset.value.id)
    } else {
      const detail = (res && (res.err || res.status)) || '远端任务失败'
      const failMsg = (res && res.jms_output) ? res.jms_output.split('\n').slice(-5).join('\n') : ''
      ElMessage.error('部署失败: ' + detail + (failMsg ? '\n' + failMsg : ''))
    }
  } catch (e) {
    const detail = (e && (e.msg || e.message)) || '网络异常'
    let failMsg = ''
    if (e && e.data) {
      if (e.data.summary && e.data.summary.failures) {
        const fails = e.data.summary.failures
        const assetName = (selectedAsset.value && selectedAsset.value.name) || ''
        failMsg = (fails[assetName] || Object.values(fails)[0] || '')
      } else if (e.data.jms_output) {
        failMsg = e.data.jms_output
      } else if (e.data.err) {
        failMsg = e.data.err
      }
    }
    ElMessage.error('部署失败: ' + detail + (failMsg ? '\n' + (failMsg.split ? failMsg.split('\n').slice(-5).join('\n') : failMsg) : ''))
  } finally {
    pulling.value = false
  }
}

onMounted(() => {
  loadRecents()
  loadAssets()
})
</script>

<template>
  <div class="online-page">
    <el-card shadow="never" class="main-card">
      <!-- 1. 选资产 -->
      <div class="field-label">
        <span class="num">1.</span>
        <span>已选资产</span>
      </div>
      <div v-if="!selectedAsset" class="asset-list-wrap" v-loading="loadingAssets">
        <el-input
          v-model="filterText"
          placeholder="搜索资产名或地址(如:点药 / 47.104)..."
          :prefix-icon="Search"
          clearable
          class="search-box"
        />
        <el-table
          :data="filteredAssets"
          stripe
          size="small"
          :row-class-name="r => recentSet.has(r.id) ? 'asset-row-recent' : ''"
          @row-click="selectAsset"
          max-height="280"
          empty-text="暂无资产"
          class="asset-table"
        >
          <el-table-column prop="name" label="名称" min-width="160">
            <template #default="{ row }">
              <span class="asset-name">{{ row.name }}</span>
              <el-tag v-if="recentSet.has(row.id)" size="small" type="warning" effect="plain" class="recent-tag">最近</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="address" label="IP/域名" min-width="140" />
          <el-table-column prop="platform" label="平台" width="100" />
          <el-table-column prop="os" label="OS" width="100" />
        </el-table>
      </div>
      <div v-else class="selected-asset">
        <div class="info-row">
          <span class="info-name">{{ selectedAsset.name }}</span>
          <el-tag size="small" type="success" effect="plain">{{ selectedAsset.platform || '?' }} · {{ selectedAsset.os || '?' }}</el-tag>
        </div>
        <div class="info-row">
          <span class="info-label">IP:</span>
          <span class="info-value mono">{{ selectedAsset.address || '-' }}</span>
          <span class="info-label" style="margin-left: 16px;">ID:</span>
          <span class="info-value mono">{{ selectedAsset.id }}</span>
        </div>
        <el-button size="small" plain :icon="Refresh" @click="reselectAsset" style="margin-top: 10px;">重新选择</el-button>
      </div>

      <el-divider />

      <!-- 2. 选项目路径 -->
      <div class="field-label">
        <span class="num">2.</span>
        <span>选择项目</span>
      </div>
      <el-select
        v-model="selectedProject"
        :placeholder="projectPlaceholder"
        :disabled="!selectedAsset"
        :loading="loadingProjects"
        value-key="id"
        @change="onProjectChange"
        class="full-width"
      >
        <el-option
          v-for="opt in projectOptions"
          :key="opt.id"
          :label="`${opt.name} (${opt.path})`"
          :value="opt"
        />
      </el-select>

      <el-divider />

      <div style="margin-top: 20px;">
        <el-button
          type="primary"
          :loading="pulling"
          :disabled="!canPull"
          @click="handlePull"
          :icon="Promotion"
        >拉取代码</el-button>
        <span style="margin-left: 12px; color: var(--el-color-info); font-size: 12px;">
          分支以服务器当前 checkout 为准(自动 git symbolic-ref --short HEAD)
        </span>
      </div>

      <!-- 结果展示 -->
      <div v-if="result" class="result-wrap">
        <el-alert
          :type="result.type"
          :title="result.title"
          :closable="false"
          show-icon
        >
          <pre class="result-text">{{ result.text }}</pre>
        </el-alert>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.online-page { padding: 16px; }
.main-card { max-width: 960px; margin: 0 auto; }
.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}
.field-label .num {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: 50%;
  font-size: 12px;
}
.count-text { margin-left: auto; color: var(--el-color-info); font-weight: normal; font-size: 12px; }

.search-box { margin-bottom: 8px; }
.asset-table { cursor: pointer; }
.asset-table :deep(tr) td { cursor: pointer; }
.asset-name { margin-right: 6px; }
.recent-tag { margin-left: 4px; }
:deep(.asset-row-recent) { background: var(--el-color-warning-light-9) !important; }

.selected-asset {
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
  padding: 12px 16px;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.info-row:last-child { margin-bottom: 0; }
.info-name { font-weight: 600; font-size: 15px; }
.info-label { color: var(--el-color-info); font-size: 12px; }
.info-value { color: var(--el-text-color-regular); }
.mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; }

.full-width { width: 100%; }
.result-wrap { margin-top: 16px; }
.result-text {
  margin: 0;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 360px;
  overflow-y: auto;
}
</style>
