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
    - upload      POST /api/codeDeploy/packages  FormData {asset_id, project_path, type, version, file, ...}
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Refresh,
  Promotion,
  Folder,
  Monitor,
  Connection,
  UploadFilled,
  Plus
} from '@element-plus/icons-vue'

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

// 上传弹窗状态
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadFile = ref(null) // el-upload 选中的原始 File
const uploadFormProjects = ref([]) // 当前选中资产对应的项目列表
const uploadForm = ref(emptyUploadForm())

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

// =====================================================
// 上传代码包
// =====================================================
function emptyUploadForm() {
  return {
    type: 'frontend',          // frontend | apk
    assetId: '',
    projectPath: '',
    version: '',
    author: 'admin',
    time: formatDateTime(new Date()),
    note: ''
  }
}

function buildProjectOptions(assetID) {
  if (!assetID) return []
  return projectTemplates
    .filter((_, i) => !assetID.endsWith(String(i).padStart(2, '0')))
    .map(p => ({ ...p }))
}

function openUploadDialog() {
  uploadForm.value = emptyUploadForm()
  // 默认预填当前选中的资产+项目,方便连续操作
  if (selectedAsset.value) {
    uploadForm.value.assetId = selectedAsset.value.id
    uploadFormProjects.value = buildProjectOptions(selectedAsset.value.id)
    if (selectedProject.value) {
      uploadForm.value.projectPath = selectedProject.value.path
    }
  } else {
    uploadFormProjects.value = []
  }
  uploadFile.value = null
  uploadDialogVisible.value = true
}

function onUploadAssetChange(assetID) {
  uploadForm.value.projectPath = ''
  uploadFormProjects.value = buildProjectOptions(assetID)
}

function onFileChange(file) {
  uploadFile.value = file.raw || null
}

function onFileRemove() {
  uploadFile.value = null
}

function genPackageName(form) {
  const seg = form.projectPath.split('/').pop() || 'app'
  const ext = form.type === 'apk' ? 'apk' : 'zip'
  return `${seg}-${form.version}.${ext}`
}

function validateUpload() {
  if (!uploadForm.value.assetId) { ElMessage.warning('请选择所属资产'); return false }
  if (!uploadForm.value.projectPath) { ElMessage.warning('请选择所属项目'); return false }
  if (!uploadForm.value.version) { ElMessage.warning('请输入版本号'); return false }
  if (!uploadFile.value) { ElMessage.warning('请选择要上传的文件'); return false }
  // 后缀名校验
  const name = (uploadFile.value.name || '').toLowerCase()
  const ok = uploadForm.value.type === 'apk'
    ? name.endsWith('.apk')
    : (name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz'))
  if (!ok) {
    ElMessage.warning(uploadForm.value.type === 'apk' ? 'APK 包请上传 .apk 文件' : '前端包请上传 .zip / .tar.gz 文件')
    return false
  }
  return true
}

async function confirmUpload() {
  if (!validateUpload()) return
  uploading.value = true
  // 模拟上传,80% 成功
  await new Promise(res => setTimeout(res, 1500 + Math.random() * 1000))
  uploading.value = false

  if (Math.random() > 0.2) {
    const newPkg = {
      id: `pkg-${Date.now()}`,
      name: genPackageName(uploadForm.value),
      time: uploadForm.value.time,
      size: `${(uploadFile.value.size / 1024 / 1024).toFixed(1)}MB`,
      author: uploadForm.value.author
    }
    ElMessage.success(`上传成功: ${newPkg.name}`)
    uploadDialogVisible.value = false
    // 如果当前选中的资产+项目 == 新包归属 → 刷新代码包列表
    if (selectedAsset.value?.id === uploadForm.value.assetId
        && selectedProject.value?.path === uploadForm.value.projectPath) {
      packageList.value = [newPkg, ...packageList.value]
      selectedPackage.value = newPkg
    }
    // 问是否立即部署
    ElMessageBox.confirm(
      `代码包 ${newPkg.name} 已上传。是否立即部署到 ${selectedAsset.value?.name || '该资产'}?`,
      '部署提示',
      { confirmButtonText: '立即部署', cancelButtonText: '稍后', type: 'success' }
    ).then(() => {
      const a = mockAssets.find(x => x.id === uploadForm.value.assetId)
      const p = uploadFormProjects.value.find(x => x.path === uploadForm.value.projectPath)
      if (a) selectedAsset.value = a
      if (p) selectedProject.value = { name: p.name, path: p.path, asset: a }
      selectedPackage.value = newPkg
      if (!packageList.value.some(x => x.id === newPkg.id)) {
        loadPackages(uploadForm.value.projectPath)
      }
    }).catch(() => { /* 稍后 */ })
  } else {
    ElMessage.error('上传失败: 网络异常,请重试')
  }
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
            <div class="header-right">
              <el-button
                size="small"
                type="primary"
                :icon="Plus"
                @click="openUploadDialog"
              >
                上传代码包
              </el-button>
              <el-tag v-if="treeData.length" size="small" type="info">
                {{ treeData.length }} 台资产
              </el-tag>
            </div>
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

    <!-- 上传代码包弹窗 -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="上传代码包"
      width="640px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="uploadForm" label-width="100px" label-position="right">
        <el-form-item label="包类型" required>
          <el-radio-group v-model="uploadForm.type">
            <el-radio value="frontend">前端包 (.zip / .tar.gz)</el-radio>
            <el-radio value="apk">APK (.apk)</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="所属资产" required>
          <el-select
            v-model="uploadForm.assetId"
            placeholder="选择资产"
            filterable
            style="width: 100%"
            @change="onUploadAssetChange"
          >
            <el-option
              v-for="a in mockAssets"
              :key="a.id"
              :label="`${a.name} (${a.ip})`"
              :value="a.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="所属项目" required>
          <el-select
            v-model="uploadForm.projectPath"
            placeholder="选择项目"
            :disabled="!uploadForm.assetId"
            style="width: 100%"
          >
            <el-option
              v-for="p in uploadFormProjects"
              :key="p.path"
              :label="`${p.name}  (${p.path})`"
              :value="p.path"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="版本号" required>
          <el-input
            v-model="uploadForm.version"
            placeholder="如: v2.4.2"
            style="width: 200px"
          />
          <span class="form-hint">
            最终包名: {{ genPackageName(uploadForm) || '(请先选项目+版本号)' }}
          </span>
        </el-form-item>

        <el-form-item label="构建人">
          <el-input v-model="uploadForm.author" placeholder="构建人" style="width: 200px" />
        </el-form-item>

        <el-form-item label="构建时间">
          <el-date-picker
            v-model="uploadForm.time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="构建时间"
            style="width: 240px"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="uploadForm.note"
            type="textarea"
            :rows="2"
            placeholder="选填,本次构建的变更说明"
          />
        </el-form-item>

        <el-form-item label="上传文件" required>
          <el-upload
            drag
            :auto-upload="false"
            :limit="1"
            :on-change="onFileChange"
            :on-remove="onFileRemove"
            accept=".apk,.zip,.tar.gz,.tgz"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此或<em>点击选择</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                <template v-if="uploadForm.type === 'apk'">
                  仅支持 .apk 格式
                </template>
                <template v-else>
                  支持 .zip / .tar.gz / .tgz
                </template>
                <span v-if="uploadFile"> · 已选: {{ uploadFile.name }} ({{ (uploadFile.size / 1024 / 1024).toFixed(2) }}MB)</span>
              </div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="confirmUpload">
          确认上传
        </el-button>
      </template>
    </el-dialog>
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

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-hint {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
  font-family: ui-monospace, Consolas, monospace;
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
