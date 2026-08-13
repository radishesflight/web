<!--
  代码拉取控制台(Online)

  还原 F:/work/go/test/cs/index.html 的页面,移植到 Vue 3 + Element Plus。
  当前用假数据,后续对接后端时:
   - assets  → GET /api/codeDeploy/assets
   - projects → GET /api/codeDeploy/assets/:id/projects
   - pull    → POST /api/codeDeploy/assets/:id/git-pull
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Tools, Refresh, Promotion, Check, Folder } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// =====================================================
// 假数据
// =====================================================
const mockAssets = [
  { id: 'a-001', name: '东平一腾服务器', ip: '47.92.254.58' },
  { id: 'a-002', name: '云红前台01', ip: '182.44.119.32' },
  { id: 'a-003', name: '云红前台02', ip: '182.44.119.29' },
  { id: 'a-004', name: '云红前台03', ip: '182.44.117.237' },
  { id: 'a-005', name: '云红后台', ip: '182.44.119.31' },
  { id: 'a-006', name: '云红控销前台', ip: '113.250.187.37' },
  { id: 'a-007', name: '云红控销后台', ip: '113.250.184.214' },
  { id: 'a-008', name: '云红直播', ip: '182.44.119.30' },
  { id: 'a-009', name: '点药官网', ip: '47.104.21.108' },
  { id: 'a-010', name: '点药H5', ip: '47.104.22.55' },
  { id: 'a-011', name: '点药后台', ip: '47.104.23.66' },
  { id: 'a-012', name: '点药-控销前台', ip: '47.104.24.77' },
  { id: 'a-013', name: '点药-控销后台', ip: '47.104.25.88' },
  { id: 'a-014', name: '点药直播', ip: '47.104.26.99' },
  { id: 'a-015', name: '点药小程序API', ip: '47.104.27.10' },
  { id: 'a-016', name: '点药支付中心', ip: '47.104.28.21' },
  { id: 'a-017', name: '点药订单中台', ip: '47.104.29.32' },
  { id: 'a-018', name: '点药-ERP', ip: '47.104.30.43' },
  { id: 'a-019', name: '点药-财务系统', ip: '47.104.31.54' },
  { id: 'a-020', name: '点药-报表系统', ip: '47.104.32.65' },
  { id: 'a-021', name: '云红-ERP', ip: '182.44.120.10' },
  { id: 'a-022', name: '云红-财务系统', ip: '182.44.120.11' },
  { id: 'a-023', name: '云红-报表系统', ip: '182.44.120.12' },
  { id: 'a-024', name: '云红-支付中心', ip: '182.44.120.13' },
  { id: 'a-025', name: '云红-订单中台', ip: '182.44.120.14' },
  { id: 'a-026', name: '云红-小程序API', ip: '182.44.120.15' },
  { id: 'a-027', name: '云红-营销活动', ip: '182.44.120.16' },
  { id: 'a-028', name: '云红-优惠券', ip: '182.44.120.17' },
  { id: 'a-029', name: '云红-会员系统', ip: '182.44.120.18' },
  { id: 'a-030', name: '云红-门店管理', ip: '182.44.120.19' },
  { id: 'a-031', name: '点药-门店管理', ip: '47.104.33.76' },
  { id: 'a-032', name: '点药-会员系统', ip: '47.104.34.87' },
  { id: 'a-033', name: '点药-优惠券', ip: '47.104.35.98' },
  { id: 'a-034', name: '点药-营销活动', ip: '47.104.36.09' },
  { id: 'a-035', name: '云红-商品中心', ip: '182.44.120.20' },
  { id: 'a-036', name: '云红-库存管理', ip: '182.44.120.21' },
  { id: 'a-037', name: '云红-物流系统', ip: '182.44.120.22' },
  { id: 'a-038', name: '点药-商品中心', ip: '47.104.37.20' },
  { id: 'a-039', name: '点药-库存管理', ip: '47.104.38.31' },
  { id: 'a-040', name: '点药-物流系统', ip: '47.104.39.42' },
  { id: 'a-041', name: '点药-数据中台', ip: '47.104.40.53' },
  { id: 'a-042', name: '云红-数据中台', ip: '182.44.120.23' },
  { id: 'a-043', name: '点药-客服系统', ip: '47.104.41.64' },
  { id: 'a-044', name: '云红-客服系统', ip: '182.44.120.24' },
  { id: 'a-045', name: '点药-消息推送', ip: '47.104.42.75' },
  { id: 'a-046', name: '云红-消息推送', ip: '182.44.120.25' },
  { id: 'a-047', name: '点药-搜索服务', ip: '47.104.43.86' },
  { id: 'a-048', name: '云红-搜索服务', ip: '182.44.120.26' },
  { id: 'a-049', name: '点药-风控系统', ip: '47.104.44.97' },
  { id: 'a-050', name: '云红-风控系统', ip: '182.44.120.27' },
  { id: 'a-051', name: '点药-定时任务', ip: '47.104.45.08' },
  { id: 'a-052', name: '云红-定时任务', ip: '182.44.120.28' },
  { id: 'a-053', name: '点药-日志收集', ip: '47.104.46.19' }
]

// 假"项目配置":每个资产都配 2~3 个可拉取项目
function mockProjects(assetID) {
  return [
    { name: 'web前台', path: '/data/www/web' },
    { name: '后台API', path: '/data/www/api' },
    { name: '管理后台', path: '/data/www/admin' }
  ].filter((_, i) => !assetID.endsWith(String(i).padStart(2, '0'))) // 制造一些差异感
}

// 假"代码包列表":按时间倒序(最新在前)
function mockPackages(projectPath) {
  const seg = projectPath.split('/').pop() || 'app' // web / api / admin
  // 固定一组版本号(从新到旧),保证每次看到的顺序一致
  const versions = [
    { v: 'v2.4.1', daysAgo: 0 },
    { v: 'v2.4.0', daysAgo: 2 },
    { v: 'v2.3.5', daysAgo: 5 },
    { v: 'v2.3.4', daysAgo: 8 },
    { v: 'v2.3.3', daysAgo: 12 },
    { v: 'v2.3.0', daysAgo: 18 },
    { v: 'v2.2.0', daysAgo: 26 }
  ]
  return versions.map((it, idx) => {
    const d = new Date()
    d.setDate(d.getDate() - it.daysAgo)
    d.setHours(10 + idx, 20 + idx * 3, 0, 0)
    return {
      id: `${seg}-pkg-${idx + 1}`,
      name: `${seg}-${it.v}.zip`,
      time: formatDateTime(d),
      size: `${(38 + idx * 1.7).toFixed(1)}MB`,
      author: ['张伟', '李娜', '王强', '赵敏', '刘洋'][idx % 5]
    }
  })
}

function formatDateTime(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// =====================================================
// 状态
// =====================================================
const allAssets = ref([])
const loadingAssets = ref(false)
const filter = ref('')
const selectedAsset = ref(null) // {id, name, ip}
const projectOptions = ref([])
const loadingProjects = ref(false)
const selectedProject = ref('')
const selectedPackage = ref(null) // {id, name, time}
const packageDialogVisible = ref(false)
const packageList = ref([])
const loadingPackages = ref(false)
const selectedPackageRow = ref(null) // 弹窗里当前选中的行
const pulling = ref(false)
const result = ref(null) // {type, text}

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

// =====================================================
// 计算属性
// =====================================================
const recentSet = computed(() => new Set(recentAssetIDs.value))

const filteredAssets = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return allAssets.value
  return allAssets.value.filter(a =>
    a.name.toLowerCase().includes(q) || a.ip.toLowerCase().includes(q)
  )
})

// 把"最近用过"排到最前面(其余保持原顺序)
const orderedAssets = computed(() => {
  const matched = filteredAssets.value
  const recents = recentAssetIDs.value
    .map(id => matched.find(a => a.id === id))
    .filter(Boolean)
  const rest = matched.filter(a => !recentSet.value.has(a.id))
  return [...recents, ...rest]
})

const assetCountText = computed(() => {
  if (allAssets.value.length === 0) return ''
  const q = filter.value.trim()
  return q
    ? `(共 ${allAssets.value.length} 台,匹配 ${orderedAssets.value.length})`
    : `(共 ${allAssets.value.length} 台)`
})

const canPull = computed(() =>
  !!(selectedAsset.value && selectedProject.value && selectedPackage.value && !pulling.value)
)

// =====================================================
// 操作
// =====================================================
function loadAssets() {
  loadingAssets.value = true
  // 模拟异步
  setTimeout(() => {
    allAssets.value = mockAssets
    loadingAssets.value = false
  }, 200)
}

function selectAsset(asset) {
  selectedAsset.value = asset
  // 重置项目 + 代码包
  selectedProject.value = ''
  selectedPackage.value = null
  result.value = null
  loadProjects(asset.id)
}

function reselectAsset() {
  selectedAsset.value = null
  selectedProject.value = ''
  selectedPackage.value = null
  projectOptions.value = []
  result.value = null
}

function loadProjects(assetID) {
  loadingProjects.value = true
  projectOptions.value = []
  setTimeout(() => {
    projectOptions.value = mockProjects(assetID)
    loadingProjects.value = false
  }, 150)
}

function onProjectChange(path) {
  if (!path) {
    selectedPackage.value = null
    return
  }
  // 重新选了项目 → 清掉之前选的包,弹窗重新选
  selectedPackage.value = null
  packageDialogVisible.value = true
  loadPackages(path)
}

function loadPackages(path) {
  loadingPackages.value = true
  packageList.value = []
  selectedPackageRow.value = null
  setTimeout(() => {
    packageList.value = mockPackages(path)
    loadingPackages.value = false
  }, 200)
}

function onPackageRowClick(row) {
  selectedPackageRow.value = row
}

function onPackageRowDblClick(row) {
  // 双击行 = 直接选中并确认
  selectedPackageRow.value = row
  confirmPackage()
}

function confirmPackage() {
  if (!selectedPackageRow.value) {
    ElMessage.warning('请先选择一个代码包')
    return
  }
  selectedPackage.value = { ...selectedPackageRow.value }
  packageDialogVisible.value = false
}

function reopenPackageDialog() {
  if (!selectedProject.value) return
  packageDialogVisible.value = true
  loadPackages(selectedProject.value)
}

function onPackageDialogClose() {
  // 没选包就关掉 = 取消 = 重置项目下拉
  if (!selectedPackage.value) {
    selectedProject.value = ''
  }
}

async function handlePull() {
  if (!canPull.value) return
  const id = selectedAsset.value.id
  const path = selectedProject.value
  const pkg = selectedPackage.value
  pulling.value = true
  result.value = {
    type: 'info',
    title: '执行中',
    text: `⏳ 正在部署代码包 ${pkg.name}\n目标: ${selectedAsset.value.name} (${selectedAsset.value.ip}) @ ${path}\n(在资产上跑大概 3-5 秒,请稍候...)`
  }
  // 模拟接口调用,80% 成功 20% 失败
  await new Promise(res => setTimeout(res, 1500 + Math.random() * 1500))
  const ok = Math.random() > 0.2
  if (ok) {
    const timeCost = (2.5 + Math.random() * 2).toFixed(2)
    result.value = {
      type: 'success',
      title: '拉取成功',
      text: `✓ 部署成功\n代码包: ${pkg.name} (${pkg.time})\n目标: ${selectedAsset.value.name} (${selectedAsset.value.ip}) @ ${path}\n耗时: ${timeCost}s`
    }
    pushRecent(id)
  } else {
    result.value = {
      type: 'error',
      title: '拉取失败',
      text: `✗ 部署失败\n代码包: ${pkg.name} (${pkg.time})\n目标: ${selectedAsset.value.name} (${selectedAsset.value.ip}) @ ${path}\n错误: 部署失败: target host unreachable`
    }
  }
  pulling.value = false
}

function handleLogout() {
  ElMessageBox.confirm('确定退出登录吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    localStorage.removeItem('token')
    ElMessage.success('已退出')
    router.push('/login')
  }).catch(() => { /* 取消 */ })
}

onMounted(() => {
  loadRecents()
  loadAssets()
})
</script>

<template>
  <div class="online-page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <div class="title">
        <el-icon :size="22"><Tools /></el-icon>
        <span>代码拉取控制台</span>
      </div>
      <el-button plain @click="handleLogout">退出</el-button>
    </header>

    <!-- 主卡片 -->
    <el-card shadow="never" class="main-card">
      <!-- 1. 选择资产 -->
      <template v-if="!selectedAsset">
        <div class="field-label">
          <span class="num">1.</span>
          <span>选择资产</span>
          <span class="count-text">{{ assetCountText }}</span>
        </div>
        <el-input
          v-model="filter"
          placeholder="🔍 搜索资产名或 IP (如:点药 / 47.104)..."
          clearable
          :prefix-icon="Search"
          size="default"
        />
        <div class="asset-list" v-loading="loadingAssets">
          <div v-if="!loadingAssets && allAssets.length === 0" class="asset-empty">
            没有可用资产
          </div>
          <div
            v-else-if="!loadingAssets && orderedAssets.length === 0"
            class="asset-empty"
          >
            没有匹配 "{{ filter }}" 的资产
          </div>
          <div
            v-for="asset in orderedAssets"
            :key="asset.id"
            class="asset-item"
            :class="{ recent: recentSet.has(asset.id) }"
            @click="selectAsset(asset)"
          >
            <span class="name">
              {{ asset.name }}
              <span v-if="recentSet.has(asset.id)" class="recent-tag">最近</span>
            </span>
            <span class="ip">{{ asset.ip }}</span>
          </div>
        </div>
      </template>

      <!-- 1'. 已选资产 -->
      <template v-else>
        <div class="field-label">
          <span class="num">1.</span>
          <span>已选资产</span>
        </div>
        <div class="selected-asset">
          <div class="sel-name">{{ selectedAsset.name }}</div>
          <div class="sel-row">
            <span class="sel-label">IP:</span>
            <span class="sel-value mono">{{ selectedAsset.ip }}</span>
          </div>
          <div class="sel-row">
            <span class="sel-label">ID:</span>
            <span class="sel-value mono">{{ selectedAsset.id }}</span>
          </div>
          <el-button size="small" plain @click="reselectAsset" :icon="Refresh" style="margin-top: 10px;">
            重新选择
          </el-button>
        </div>
      </template>

      <el-divider />

      <!-- 2. 选择项目 -->
      <div class="field-label">
        <span class="num">2.</span>
        <span>选择项目</span>
      </div>
      <el-select
        v-model="selectedProject"
        placeholder="-- 请先选资产 --"
        :disabled="!selectedAsset"
        :loading="loadingProjects"
        @change="onProjectChange"
        style="width: 100%"
        size="default"
      >
        <el-option
          v-for="p in projectOptions"
          :key="p.path"
          :label="`${p.name}  (${p.path})`"
          :value="p.path"
        />
        <el-option
          v-if="selectedAsset && !loadingProjects && projectOptions.length === 0"
          disabled
          label="该资产没有配置可拉取的项目"
        />
      </el-select>

      <el-divider />

      <!-- 3. 选择代码包 -->
      <div class="field-label">
        <span class="num">3.</span>
        <span>选择代码包</span>
        <span v-if="selectedPackage" class="count-text">已选 1 个</span>
      </div>
      <div v-if="selectedPackage" class="selected-package">
        <el-icon :size="20" color="#67c23a"><Folder /></el-icon>
        <div class="pkg-info">
          <div class="pkg-name">{{ selectedPackage.name }}</div>
          <div class="pkg-meta">{{ selectedPackage.time }} · {{ selectedPackage.size }} · {{ selectedPackage.author }}</div>
        </div>
        <el-button size="small" plain @click="reopenPackageDialog" :icon="Refresh">重新选择</el-button>
      </div>
      <el-button
        v-else
        :disabled="!selectedProject"
        plain
        :icon="Folder"
        @click="reopenPackageDialog"
        style="width: 100%"
      >
        点击选择代码包
      </el-button>

      <div style="margin-top: 20px;">
        <el-button
          type="primary"
          :loading="pulling"
          :disabled="!canPull"
          @click="handlePull"
          :icon="Promotion"
        >
          拉取代码
        </el-button>
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

    <!-- 选择代码包弹窗 -->
    <el-dialog
      v-model="packageDialogVisible"
      title="选择代码包"
      width="700px"
      :close-on-click-modal="false"
      @close="onPackageDialogClose"
    >
      <el-table
        :data="packageList"
        v-loading="loadingPackages"
        stripe
        highlight-current-row
        :current-row-key="selectedPackageRow?.id"
        @row-click="onPackageRowClick"
        @row-dblclick="onPackageRowDblClick"
        max-height="420"
        style="cursor: pointer;"
      >
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="name" label="包名" min-width="220" show-overflow-tooltip />
        <el-table-column prop="time" label="构建时间" width="180" />
        <el-table-column prop="size" label="大小" width="90" />
        <el-table-column prop="author" label="构建人" width="100" />
      </el-table>
      <template #footer>
        <el-button @click="packageDialogVisible = false">取消</el-button>
        <el-button type="primary" :icon="Check" @click="confirmPackage">确认选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.online-page {
  max-width: 100%;
  margin: 0 auto;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-header .title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 600;
  color: #1a202c;
}

.main-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #4a5568;
  font-weight: 500;
  margin-bottom: 10px;
}

.field-label .num {
  font-weight: 600;
  color: #2c3e50;
}

.field-label .count-text {
  font-weight: normal;
  color: #718096;
  font-size: 12px;
  margin-left: 4px;
}

.asset-list {
  margin-top: 10px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
}

.asset-item {
  padding: 10px 14px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.1s;
}

.asset-item:hover {
  background: #ecf5ff;
}

.asset-item:last-child {
  border-bottom: none;
}

.asset-item .name {
  font-weight: 500;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 6px;
}

.asset-item .ip {
  color: #718096;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}

.asset-empty {
  padding: 24px 14px;
  color: #a0aec0;
  font-size: 13px;
  text-align: center;
}

.asset-item.recent {
  background: #f0fdf4;
}

.asset-item.recent:hover {
  background: #dcfce7;
}

.recent-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: normal;
  background: #48bb78;
  color: white;
  padding: 1px 6px;
  border-radius: 3px;
}

.selected-asset {
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  padding: 14px 16px;
}

.sel-name {
  font-size: 15px;
  font-weight: 600;
  color: #2c5282;
  margin-bottom: 8px;
}

.sel-row {
  font-size: 12px;
  color: #4a5568;
  margin-top: 4px;
  display: flex;
  gap: 6px;
}

.sel-label {
  color: #718096;
  flex-shrink: 0;
}

.sel-value.mono,
.mono {
  font-family: ui-monospace, Consolas, monospace;
  word-break: break-all;
}

.selected-package {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #bae0ff;
  border-radius: 6px;
}

.selected-package .pkg-info {
  flex: 1;
  min-width: 0;
}

.selected-package .pkg-name {
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
  word-break: break-all;
}

.selected-package .pkg-meta {
  font-size: 12px;
  color: #718096;
  margin-top: 2px;
}

.result-wrap {
  margin-top: 16px;
}

.result-text {
  margin: 0;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  color: inherit;
}
</style>
