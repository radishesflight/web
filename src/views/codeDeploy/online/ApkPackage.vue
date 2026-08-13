<!--
  apk / 前端包管理

  布局:
    左侧: 树结构(业务项目 -> 端)
      父节点: 业务项目名,如 "b2b电商项目"
      子节点: 端,4 选 N(苹果 / 安卓 / 前台web / 后台web)
    右侧: 根据左侧选择展示
      - 选项目节点 -> 项目信息
      - 选端节点 -> 该端下的代码包列表 + 选包 + 拉取

  假数据,后续接接口:
    - tree        GET /api/codeDeploy/tree   返回业务项目 + 端层级
    - packages    GET /api/codeDeploy/endpoints/packages?project_id=&endpoint=
    - pull        POST /api/codeDeploy/endpoints/pull {project_id, endpoint, pkg_id}
    - upload      POST /api/codeDeploy/packages  FormData {project_id, endpoint, type, file, ...}
                  (后端自动生成版本号 + 包名,返回 {id, name, time, size, author, url})
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Refresh,
  Promotion,
  Folder,
  Connection,
  UploadFilled,
  Plus,
  Iphone,
  Cellphone,
  Monitor as Pc,
  Setting
} from '@element-plus/icons-vue'

// =====================================================
// 假数据
// =====================================================

// 4 个固定端(全量端列表,树里按业务需要只展示其中部分)
const ALL_ENDPOINTS = [
  { name: '苹果', ext: 'apk', icon: Iphone, slug: 'ios' },
  { name: '安卓', ext: 'apk', icon: Cellphone, slug: 'android' },
  { name: '前台web', ext: 'zip', icon: Pc, slug: 'web' },
  { name: '后台web', ext: 'zip', icon: Setting, slug: 'admin' }
]

// 业务项目(树父节点) - 每个项目声明自己有哪些端
const mockProjects = [
  { id: 'p-001', name: 'b2b电商项目', endpoints: ['苹果', '安卓', '前台web', '后台web'] },
  { id: 'p-002', name: '云红erp', endpoints: ['前台web', '后台web'] },
  { id: 'p-003', name: '点药小程序', endpoints: ['苹果', '安卓'] },
  { id: 'p-004', name: '云红直播', endpoints: ['苹果', '安卓', '前台web'] },
  { id: 'p-005', name: '点药官网', endpoints: ['前台web', '后台web'] },
  { id: 'p-006', name: '云红控销', endpoints: ['安卓', '后台web'] },
  { id: 'p-007', name: '点药支付中心', endpoints: ['后台web'] },
  { id: 'p-008', name: '云红会员系统', endpoints: ['苹果', '安卓', '后台web'] },
  { id: 'p-009', name: '点药订单中台', endpoints: ['后台web'] },
  { id: 'p-010', name: '云红数据中台', endpoints: ['后台web'] },
  { id: 'p-011', name: '点药财务系统', endpoints: ['后台web'] },
  { id: 'p-012', name: '云红客服系统', endpoints: ['苹果', '安卓'] }
]

function buildTree() {
  return mockProjects.map(p => ({
    id: `project:${p.id}`,
    label: p.name,
    raw: p,
    children: p.endpoints.map(epName => {
      const ep = ALL_ENDPOINTS.find(e => e.name === epName)
      return {
        id: `endpoint:${p.id}:${epName}`,
        label: epName,
        raw: { project: p, endpoint: ep }
      }
    })
  }))
}

function mockPackages(projectId, endpointName) {
  const ep = ALL_ENDPOINTS.find(e => e.name === endpointName)
  const ext = ep ? ep.ext : 'zip'
  // 模拟"后端生成"的版本号 + 包名
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
      id: `${projectId}-${ep.slug}-pkg-${idx + 1}`,
      name: `${ep.slug}-${it.v}.${ext}`, // ← 模拟后端返回
      time: formatDateTime(d),
      size: `${(38 + idx * 1.7).toFixed(1)}MB`,
      author: ['张伟', '李娜', '王强', '赵敏', '刘洋'][idx % 5]
    }
  })
}

// 模拟"后端生成包名": 上传成功后,后端会返回什么
function fakeBackendPackageName(endpointName) {
  const ep = ALL_ENDPOINTS.find(e => e.name === endpointName)
  const ext = ep ? ep.ext : 'zip'
  const slug = ep ? ep.slug : 'app'
  // 模拟一个递增的版本号(v2.4.x)
  const patch = Math.floor(Math.random() * 10)
  return `${slug}-v2.5.${patch}.${ext}`
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

const selectedNode = ref(null)
const selectedProject = ref(null) // 业务项目 {id, name, endpoints}
const selectedEndpoint = ref(null) // 端 {name, ext, icon, slug, project}
const packageList = ref([])
const loadingPackages = ref(false)
const selectedPackage = ref(null)
const pulling = ref(false)
const result = ref(null)

// 上传弹窗状态
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadFile = ref(null)
const uploadFormProjects = ref([]) // 业务项目列表(下拉)
const uploadForm = ref(emptyUploadForm())

// =====================================================
// 计算属性
// =====================================================
const filterNode = (value, data) => {
  if (!value) return true
  return data.label.includes(value)
}

const canPull = computed(() => !!(selectedEndpoint.value && selectedPackage.value && !pulling.value))

// =====================================================
// 操作 - 树
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
  result.value = null
  selectedPackage.value = null
  packageList.value = []

  if (node.id.startsWith('project:')) {
    selectedProject.value = node.raw
    selectedEndpoint.value = null
  } else if (node.id.startsWith('endpoint:')) {
    selectedProject.value = node.raw.project
    selectedEndpoint.value = {
      name: node.label,
      endpoint: node.raw.endpoint,
      project: node.raw.project
    }
    loadPackages(node.raw.project.id, node.label)
  }
}

function resetSelection() {
  selectedNode.value = null
  selectedProject.value = null
  selectedEndpoint.value = null
  packageList.value = []
  selectedPackage.value = null
  result.value = null
}

function loadPackages(projectId, endpointName) {
  loadingPackages.value = true
  packageList.value = []
  setTimeout(() => {
    packageList.value = mockPackages(projectId, endpointName)
    loadingPackages.value = false
  }, 200)
}

function onPackageSelect(pkg) {
  selectedPackage.value = pkg
}

// =====================================================
// 操作 - 拉取
// =====================================================
async function handlePull() {
  if (!canPull.value) return
  const proj = selectedEndpoint.value.project
  const ep = selectedEndpoint.value.endpoint
  const pkg = selectedPackage.value
  pulling.value = true
  result.value = {
    type: 'info',
    title: '执行中',
    text: `⏳ 正在部署 ${pkg.name}\n目标: ${proj.name} (${ep.name})\n(大概 3-5 秒,请稍候...)`
  }
  await new Promise(res => setTimeout(res, 1500 + Math.random() * 1500))
  const ok = Math.random() > 0.2
  if (ok) {
    const timeCost = (2.5 + Math.random() * 2).toFixed(2)
    result.value = {
      type: 'success',
      title: '拉取成功',
      text: `✓ 部署成功\n代码包: ${pkg.name} (${pkg.time})\n目标: ${proj.name} (${ep.name})\n耗时: ${timeCost}s`
    }
  } else {
    result.value = {
      type: 'error',
      title: '拉取失败',
      text: `✗ 部署失败\n代码包: ${pkg.name} (${pkg.time})\n目标: ${proj.name} (${ep.name})\n错误: 部署失败: target host unreachable`
    }
  }
  pulling.value = false
}

// =====================================================
// 上传代码包
// =====================================================
function emptyUploadForm() {
  return {
    projectId: '',
    endpoint: '',
    author: 'admin',
    time: formatDateTime(new Date()),
    note: ''
  }
}

function openUploadDialog() {
  uploadForm.value = emptyUploadForm()
  uploadFormProjects.value = [...mockProjects]
  // 默认预填当前选中的项目+端
  if (selectedProject.value) {
    uploadForm.value.projectId = selectedProject.value.id
    if (selectedEndpoint.value) {
      uploadForm.value.endpoint = selectedEndpoint.value.endpoint.name
    }
  }
  uploadFile.value = null
  uploadDialogVisible.value = true
}

function onUploadProjectChange() {
  uploadForm.value.endpoint = ''
}

function endpointOptionsForProject(projectId) {
  const p = mockProjects.find(x => x.id === projectId)
  if (!p) return []
  return ALL_ENDPOINTS.filter(ep => p.endpoints.includes(ep.name))
}

function onFileChange(file) {
  uploadFile.value = file.raw || null
}

function onFileRemove() {
  uploadFile.value = null
}

function validateUpload() {
  if (!uploadForm.value.projectId) { ElMessage.warning('请选择所属项目'); return false }
  if (!uploadForm.value.endpoint) { ElMessage.warning('请选择所属端'); return false }
  if (!uploadFile.value) { ElMessage.warning('请选择要上传的文件'); return false }
  const name = (uploadFile.value.name || '').toLowerCase()
  const ep = ALL_ENDPOINTS.find(e => e.name === uploadForm.value.endpoint)
  const expectedExt = ep ? ep.ext : ''
  if (expectedExt === 'apk' && !name.endsWith('.apk')) {
    ElMessage.warning('苹果/安卓端请上传 .apk 文件')
    return false
  }
  if (expectedExt === 'zip' && !(name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz'))) {
    ElMessage.warning(`${uploadForm.value.endpoint} 请上传 .zip / .tar.gz 文件`)
    return false
  }
  return true
}

async function confirmUpload() {
  if (!validateUpload()) return
  uploading.value = true
  // 模拟上传 + 后端生成包名
  await new Promise(res => setTimeout(res, 1500 + Math.random() * 1000))
  uploading.value = false

  if (Math.random() > 0.2) {
    const newPkg = {
      id: `pkg-${Date.now()}`,
      name: fakeBackendPackageName(uploadForm.value.endpoint, uploadFile.value.name),
      time: uploadForm.value.time,
      size: `${(uploadFile.value.size / 1024 / 1024).toFixed(1)}MB`,
      author: uploadForm.value.author
    }
    ElMessage.success(`上传成功: ${newPkg.name}`)
    uploadDialogVisible.value = false
    // 如果当前选中的项目+端 == 新包归属 → 刷新代码包列表
    if (selectedProject.value?.id === uploadForm.value.projectId
        && selectedEndpoint.value?.endpoint?.name === uploadForm.value.endpoint) {
      packageList.value = [newPkg, ...packageList.value]
      selectedPackage.value = newPkg
    }
    // 问是否立即部署
    const proj = mockProjects.find(x => x.id === uploadForm.value.projectId)
    ElMessageBox.confirm(
      `代码包 ${newPkg.name} 已上传。是否立即部署到 ${proj?.name} (${uploadForm.value.endpoint})?`,
      '部署提示',
      { confirmButtonText: '立即部署', cancelButtonText: '稍后', type: 'success' }
    ).then(() => {
      if (proj) selectedProject.value = proj
      selectedEndpoint.value = {
        name: uploadForm.value.endpoint,
        endpoint: ALL_ENDPOINTS.find(e => e.name === uploadForm.value.endpoint),
        project: proj
      }
      selectedPackage.value = newPkg
      if (!packageList.value.some(x => x.id === newPkg.id)) {
        loadPackages(uploadForm.value.projectId, uploadForm.value.endpoint)
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
            <span>业务项目 / 端</span>
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
                {{ treeData.length }} 个项目
              </el-tag>
            </div>
          </div>
        </template>

        <el-input
          v-model="filterText"
          placeholder="🔍 搜索项目或端"
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
              <template v-if="data.id.startsWith('project:')">
                <el-icon :size="14" class="node-icon project">
                  <Folder />
                </el-icon>
                <span class="node-label">{{ node.label }}</span>
                <el-tag size="small" type="info" effect="plain" class="node-meta">
                  {{ data.raw.endpoints.length }} 端
                </el-tag>
              </template>
              <template v-else>
                <el-icon :size="14" class="node-icon endpoint">
                  <component :is="data.raw.endpoint.icon" />
                </el-icon>
                <span class="node-label">{{ node.label }}</span>
                <span class="node-meta">{{ data.raw.endpoint.ext }}</span>
              </template>
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
              v-if="selectedProject || selectedEndpoint"
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
          v-if="!selectedProject && !selectedEndpoint"
          description="左侧选择业务项目或端后查看详情"
          :image-size="100"
        />

        <!-- 选了项目(父节点)但没选端 -->
        <div v-else-if="selectedProject && !selectedEndpoint" class="project-info">
          <div class="info-title">
            <el-icon :size="20" color="#409eff"><Folder /></el-icon>
            <span>{{ selectedProject.name }}</span>
          </div>
          <el-descriptions :column="1" border size="default" style="margin-top: 12px;">
            <el-descriptions-item label="项目 ID">
              <span class="mono">{{ selectedProject.id }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="端数量">
              {{ selectedProject.endpoints.length }} 个 ({{ selectedProject.endpoints.join('、') }})
            </el-descriptions-item>
          </el-descriptions>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 16px;"
          >
            请展开左侧该项目节点,选择具体端(苹果 / 安卓 / 前台web / 后台web)以查看代码包
          </el-alert>
        </div>

        <!-- 选了端(子节点) - 显示代码包列表 -->
        <div v-else-if="selectedEndpoint" class="endpoint-detail">
          <div class="info-title">
            <span class="info-prefix">所属项目: <strong>{{ selectedEndpoint.project.name }}</strong></span>
            <el-icon :size="20" :color="selectedEndpoint.endpoint.ext === 'apk' ? '#67c23a' : '#409eff'">
              <component :is="selectedEndpoint.endpoint.icon" />
            </el-icon>
            <span>{{ selectedEndpoint.endpoint.name }}</span>
            <el-tag size="small" type="info" style="margin-left: 8px;">
              格式: .{{ selectedEndpoint.endpoint.ext }}
            </el-tag>
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
              <el-table-column prop="name" label="包名" min-width="220" show-overflow-tooltip />
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
        <el-form-item label="所属项目" required>
          <el-select
            v-model="uploadForm.projectId"
            placeholder="选择业务项目"
            filterable
            style="width: 100%"
            @change="onUploadProjectChange"
          >
            <el-option
              v-for="p in uploadFormProjects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="所属端" required>
          <el-select
            v-model="uploadForm.endpoint"
            placeholder="选择端"
            :disabled="!uploadForm.projectId"
            style="width: 100%"
          >
            <el-option
              v-for="ep in endpointOptionsForProject(uploadForm.projectId)"
              :key="ep.name"
              :label="`${ep.name}  (.${ep.ext})`"
              :value="ep.name"
            />
          </el-select>
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
                包名 / 版本号由后端自动生成,无需填写
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

.node-icon.project { color: #409eff; }
.node-icon.endpoint { color: #67c23a; }

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-meta {
  font-size: 11px;
  color: #909399;
  font-family: ui-monospace, Consolas, monospace;
}

.project-info,
.endpoint-detail {
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
