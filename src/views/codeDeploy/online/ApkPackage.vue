<!--
  apk / 前端包管理

  布局:
    左侧: 树结构(资产 -> 项目)
    右侧: 根据左侧选择展示
      - 选资产节点 -> 资产信息卡
      - 选项目节点 -> 该项目下的代码包列表 + 选包 + 拉取

  假数据,后续接接口:
    - tree        GET /api/codeDeploy/tree   返回资产/项目层级
    - packages    GET /api/codeDeploy/projects/:id/packages
    - pull        POST /api/codeDeploy/projects/:id/pull {pkg_id}
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Tools,
  Refresh,
  Promotion,
  Folder,
  Monitor,
  Connection
} from '@element-plus/icons-vue'
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
  { id: 'a-015', name: '点药小程序API', ip: '47.104.27.10' }
]

const projectTemplates = [
  { name: 'web前台', path: '/data/www/web' },
  { name: '后台API', path: '/data/www/api' },
  { name: '管理后台', path: '/data/www/admin' }
]

function buildTree() {
  return mockAssets.map(a => ({
    id: `asset:${a.id}`,
    label: a.name,
    raw: a,
    children: projectTemplates
      .filter((_, i) => !a.id.endsWith(String(i).padStart(2, '0')))
      .map((p, idx) => ({
        id: `project:${a.id}:${idx}`,
        label: p.name,
        path: p.path,
        raw: { ...p, asset: a }
      }))
  }))
}

function mockPackages(projectPath) {
  const seg = projectPath.split('/').pop() || 'app'
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
const treeData = ref([])
const treeLoading = ref(false)
const filterText = ref('')
const defaultExpanded = computed(() => treeData.value.slice(0, 3).map(n => n.id))

const selectedNode = ref(null) // 树里当前点击的节点
const selectedAsset = ref(null) // {id, name, ip}
const selectedProject = ref(null) // {name, path, asset}
const packageList = ref([])
const loadingPackages = ref(false)
const selectedPackage = ref(null) // {id, name, time, ...}
const pulling = ref(false)
const result = ref(null) // {type, title, text}

// =====================================================
// 计算属性
// =====================================================
const filterNode = (value, data) => {
  if (!value) return true
  return data.label.includes(value)
}

const canPull = computed(() => !!(selectedProject.value && selectedPackage.value && !pulling.value))

// =====================================================
// 操作
// =====================================================
function loadTree() {
  treeLoading.value = true
  setTimeout(() => {
    treeData.value = buildTree()
    treeLoading.value = false
  }, 200)
}

function onTreeNodeClick(node) {
  selectedNode.value = node
  // 重置下半区
  result.value = null
  selectedPackage.value = null
  packageList.value = []

  if (node.id.startsWith('asset:')) {
    // 只选资产,清项目
    selectedAsset.value = node.raw
    selectedProject.value = null
  } else if (node.id.startsWith('project:')) {
    // 选项目,同时确定资产
    selectedAsset.value = node.raw.asset
    selectedProject.value = { name: node.label, path: node.path }
    loadPackages(node.path)
  }
}

function loadPackages(path) {
  loadingPackages.value = true
  packageList.value = []
  setTimeout(() => {
    packageList.value = mockPackages(path)
    loadingPackages.value = false
  }, 200)
}

function onPackageSelect(pkg) {
  selectedPackage.value = pkg
}

async function handlePull() {
  if (!canPull.value) return
  const asset = selectedAsset.value
  const proj = selectedProject.value
  const pkg = selectedPackage.value
  pulling.value = true
  result.value = {
    type: 'info',
    title: '执行中',
    text: `⏳ 正在部署代码包 ${pkg.name}\n目标: ${asset.name} (${asset.ip}) @ ${proj.path}\n(在资产上跑大概 3-5 秒,请稍候...)`
  }
  await new Promise(res => setTimeout(res, 1500 + Math.random() * 1500))
  const ok = Math.random() > 0.2
  if (ok) {
    const timeCost = (2.5 + Math.random() * 2).toFixed(2)
    result.value = {
      type: 'success',
      title: '拉取成功',
      text: `✓ 部署成功\n代码包: ${pkg.name} (${pkg.time})\n目标: ${asset.name} (${asset.ip}) @ ${proj.path}\n耗时: ${timeCost}s`
    }
  } else {
    result.value = {
      type: 'error',
      title: '拉取失败',
      text: `✗ 部署失败\n代码包: ${pkg.name} (${pkg.time})\n目标: ${asset.name} (${asset.ip}) @ ${proj.path}\n错误: 部署失败: target host unreachable`
    }
  }
  pulling.value = false
}

onMounted(loadTree)
</script>

<template>
  <div class="apk-page">
    <!-- 主体两栏 -->
    <div class="main-layout">
      <!-- 左侧:树结构 -->
      <el-card shadow="never" class="tree-card">
        <template #header>
          <div class="card-header">
            <span>资产 / 项目</span>
            <el-tag v-if="treeData.length" size="small" type="info">
              {{ treeData.length }} 台资产
            </el-tag>
          </div>
        </template>

        <el-input
          v-model="filterText"
          placeholder="🔍 搜索资产或项目"
          clearable
          :prefix-icon="Search"
          size="default"
          style="margin-bottom: 12px;"
        />

        <el-tree
          v-loading="treeLoading"
          :data="treeData"
          node-key="id"
          :default-expanded-keys="defaultExpanded"
          :filter-node-method="filterNode"
          :expand-on-click-node="false"
          highlight-current
          @node-click="onTreeNodeClick"
          class="dept-tree"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <el-icon :size="14" v-if="data.id.startsWith('asset:')" class="node-icon asset">
                <Monitor />
              </el-icon>
              <el-icon :size="14" v-else class="node-icon project">
                <Folder />
              </el-icon>
              <span class="node-label">{{ node.label }}</span>
              <span v-if="data.id.startsWith('asset:')" class="node-meta">{{ data.raw.ip }}</span>
              <span v-else class="node-meta">{{ data.path }}</span>
            </span>
          </template>
        </el-tree>
      </el-card>

      <!-- 右侧:详情 -->
      <el-card shadow="never" class="detail-card">
        <template #header>
          <div class="card-header">
            <span>详情</span>
            <el-button
              v-if="selectedAsset || selectedProject"
              size="small"
              plain
              :icon="Refresh"
              @click="resetSelection"
            >
              清空选择
            </el-button>
          </div>
        </template>

        <!-- 空状态 -->
        <el-empty
          v-if="!selectedAsset && !selectedProject"
          description="左侧选择资产或项目后查看详情"
          :image-size="100"
        />

        <!-- 资产信息卡 -->
        <div v-else-if="selectedAsset && !selectedProject" class="asset-info">
          <div class="info-title">
            <el-icon :size="20" color="#409eff"><Monitor /></el-icon>
            <span>{{ selectedAsset.name }}</span>
          </div>
          <el-descriptions :column="1" border size="default" style="margin-top: 12px;">
            <el-descriptions-item label="资产 ID">
              <span class="mono">{{ selectedAsset.id }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="IP">
              <span class="mono">{{ selectedAsset.ip }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="项目数">
              {{ treeData.find(t => t.raw.id === selectedAsset.id)?.children?.length || 0 }} 个
            </el-descriptions-item>
          </el-descriptions>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 16px;"
          >
            请展开左侧该资产节点,选择具体项目以查看代码包
          </el-alert>
        </div>

        <!-- 项目 + 代码包列表 -->
        <div v-else-if="selectedProject" class="project-detail">
          <div class="info-title">
            <span class="info-prefix">所属资产: <strong>{{ selectedAsset.name }}</strong></span>
            <el-icon :size="20" color="#67c23a"><Folder /></el-icon>
            <span>{{ selectedProject.name }}</span>
            <el-tag size="small" type="info" style="margin-left: 8px;">{{ selectedProject.path }}</el-tag>
          </div>

          <div class="pkg-section">
            <div class="field-label">
              <span>代码包</span>
              <span class="count-text">(共 {{ packageList.length }} 个,最新在前)</span>
            </div>

            <el-table
              :data="packageList"
              v-loading="loadingPackages"
              stripe
              highlight-current-row
              :current-row-key="selectedPackage?.id"
              @row-click="onPackageSelect"
              max-height="320"
              style="cursor: pointer;"
            >
              <el-table-column type="index" label="#" width="50" />
              <el-table-column prop="name" label="包名" min-width="200" show-overflow-tooltip />
              <el-table-column prop="time" label="构建时间" width="170" />
              <el-table-column prop="size" label="大小" width="80" />
              <el-table-column prop="author" label="构建人" width="90" />
            </el-table>

            <div v-if="selectedPackage" class="selected-pkg">
              <el-icon :size="16" color="#67c23a"><Connection /></el-icon>
              <span>已选: <strong>{{ selectedPackage.name }}</strong> · {{ selectedPackage.time }}</span>
            </div>
          </div>

          <div class="actions">
            <el-button
              type="primary"
              :loading="pulling"
              :disabled="!canPull"
              :icon="Promotion"
              @click="handlePull"
            >
              拉取代码
            </el-button>
          </div>

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
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.apk-page {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header .title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 600;
  color: #1a202c;
}

.main-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  align-items: start;
}

.tree-card,
.detail-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
}

.dept-tree {
  max-height: calc(100vh - 240px);
  overflow-y: auto;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  font-size: 13px;
  padding: 2px 0;
}

.node-icon.asset { color: #409eff; }
.node-icon.project { color: #67c23a; }

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-meta {
  color: #909399;
  font-size: 11px;
  font-family: ui-monospace, Consolas, monospace;
}

.asset-info,
.project-detail {
  padding: 4px 4px 12px;
}

.info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.info-prefix {
  font-size: inherit;
  font-weight: normal;
  color: #4a5568;
  margin-right: 4px;
}

.info-prefix strong {
  color: #1a202c;
  font-weight: 600;
}

.mono {
  font-family: ui-monospace, Consolas, monospace;
  word-break: break-all;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #4a5568;
  font-weight: 500;
  margin: 16px 0 10px;
}

.field-label .count-text {
  font-weight: normal;
  color: #718096;
  font-size: 12px;
}

.pkg-section {
  margin-top: 8px;
}

.selected-pkg {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f0f9ff;
  border: 1px solid #bae0ff;
  border-radius: 4px;
  font-size: 13px;
  color: #4a5568;
  display: flex;
  align-items: center;
  gap: 6px;
}

.actions {
  margin-top: 16px;
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
