<!--
  apk / 前端包管理

  布局:
    左侧: 树结构(业务项目 -> 端)
      父节点: 业务项目名,如 "b2b电商项目"
      子节点: 端,4 选 N(苹果 / 安卓 / 前台web / 后台web)
    右侧: 根据左侧选择展示
      - 选项目节点 -> 项目信息
      - 选端节点 -> 该端下的代码包列表 + 选包 + 拉取

  数据来源:后端 API
    - tree        GET /api/codeDeploy/projects/tree
    - packages    GET /api/codeDeploy/packages?project_id=&endpoint_id=
    - pull        POST /api/codeDeploy/packages/:id/pull
    - upload      POST /api/codeDeploy/packages
                  (后端自动生成 version + 拼接 full_name,返回 {id, full_name, file_url, ...})
    - endpoints   GET /api/codeDeploy/endpoints(端字典,弹窗下拉用)
-->
<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
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
import {
  getEndpoints,
  getProjectTree,
  getPackages,
  uploadPackage,
  pullPackage
} from '@/api/codeDeploy'
import JSZip from 'jszip'

// 前端文件夹总大小限制(超过就拦下,后端 200MB 硬限制)
const FOLDER_SIZE_LIMIT = 300 * 1024 * 1024

// =====================================================
// 图标映射(后端 code_endpoints.icon 字符串 -> el-icon 组件)
// =====================================================
const ICON_MAP = {
  Iphone: Iphone,
  Cellphone: Cellphone,
  Monitor: Pc,
  Setting: Setting
}
const resolveIcon = name => ICON_MAP[name] || Folder

// =====================================================
// 状态
// =====================================================
const treeData = ref([])         // 后端返回的树(项目 + 端嵌套结构)
const projectsForSelect = ref([]) // 项目原始数据(弹窗下拉用,id 是数字)
const treeLoading = ref(false)
const filterText = ref('')
const defaultExpanded = computed(() => treeData.value.slice(0, 3).map(n => n.id))

const allEndpoints = ref([])     // 端字典(下拉用),从后端 getEndpoints() 拉
const selectedNode = ref(null)
const selectedProject = ref(null) // 业务项目 {id, code, name, description, endpoints: [...]}
const selectedEndpoint = ref(null) // 端 {id, name, ext, icon, slug, project}
const packageList = ref([])
const loadingPackages = ref(false)
const selectedPackage = ref(null)
const pulling = ref(false)
const result = ref(null)

// 上传弹窗
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const packing = ref(false)         // JSZip 打包中
const packingProgress = ref(0)     // 打包进度 0~100
const uploadFile = ref(null)       // 单文件模式(ios/android)
const selectedFiles = ref([])      // 文件夹模式文件列表(web)
const uploadForm = ref(emptyUploadForm())
const fileInputRef = ref(null)     // native input 引用,手动设 webkitdirectory

// =====================================================
// 计算属性
// =====================================================
const filterNode = (value, data) => {
  if (!value) return true
  return data.label.includes(value)
}

const canPull = computed(() => !!(selectedEndpoint.value && selectedPackage.value && !pulling.value))

// 上传按钮的可用条件:有项目+端+文件,且总大小 > 0
const canUpload = computed(() => {
  if (!uploadForm.value.projectId || !uploadForm.value.endpoint) return false
  if (uploading.value || packing.value) return false
  if (isFolderMode.value) {
    return selectedFiles.value.length > 0 && totalSizeMB.value > 0
  }
  return !!uploadFile.value && uploadFile.value.size > 0
})

// 当前选中项目下能选的端(下拉用,等价于后端返回的 project.endpoints)
const endpointOptionsForProject = computed(() => {
  if (!uploadForm.value.projectId) return []
  const p = projectsForSelect.value.find(x => x.id === uploadForm.value.projectId)
  return p?.endpoints || []
})

// 当前端是不是"文件夹模式"(前台web/后台web 走整目录)
// 判定规则:ext 是 zip(后续 iOS 改 ipa 后再加分支)
const isFolderMode = computed(() => {
  const ep = endpointOptionsForProject.value.find(e => e.name === uploadForm.value.endpoint)
  if (!ep) return false
  return ep.ext === 'zip'
})

// 当前选中文件(单文件模式)或文件列表(文件夹模式)的总大小(MB)
const totalSizeMB = computed(() => {
  if (isFolderMode.value) {
    const total = selectedFiles.value.reduce((sum, f) => sum + (f.size || 0), 0)
    return total / 1024 / 1024
  }
  return uploadFile.value ? uploadFile.value.size / 1024 / 1024 : 0
})

// 文件夹名(取第一个文件的相对路径第一段)
const folderName = computed(() => {
  if (!isFolderMode.value || selectedFiles.value.length === 0) return ''
  const f = selectedFiles.value[0]
  // webkitRelativePath 形如 "my-project/index.html"
  if (f.webkitRelativePath) {
    return f.webkitRelativePath.split('/')[0]
  }
  // fallback 到文件名前缀(去后缀)
  return f.name.replace(/\.[^.]+$/, '') || 'package'
})

// =====================================================
// 操作 - 树
// =====================================================
async function loadTree() {
  treeLoading.value = true
  try {
    const { data } = await getProjectTree()
    const projects = data.list || []
    // 原始数据存一份(弹窗下拉用,id 是数字)
    projectsForSelect.value = projects
    // 包成 el-tree 节点(id 加 'project:' / 'endpoint:' 前缀)
    treeData.value = projects.map(p => ({
      id: `project:${p.id}`,
      label: p.name,
      raw: p,
      children: (p.endpoints || []).map(ep => ({
        id: `endpoint:${p.id}:${ep.id}`,
        label: ep.name,
        raw: { project: p, endpoint: ep }
      }))
    }))
  } catch (e) {
    ElMessage.error('加载项目树失败')
    console.error(e)
  } finally {
    treeLoading.value = false
  }
}

async function loadAllEndpoints() {
  try {
    const { data } = await getEndpoints()
    allEndpoints.value = data.list || []
  } catch (e) {
    console.error(e)
  }
}

function onTreeNodeClick(node) {
  selectedNode.value = node
  result.value = null
  selectedPackage.value = null
  packageList.value = []

  if (String(node.id).startsWith('project:')) {
    selectedProject.value = node.raw
    selectedEndpoint.value = null
  } else if (String(node.id).startsWith('endpoint:')) {
    selectedProject.value = node.raw.project
    selectedEndpoint.value = {
      name: node.label,
      endpoint: node.raw.endpoint,
      project: node.raw.project
    }
    loadPackages(node.raw.project.id, node.raw.endpoint.id)
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

async function loadPackages(projectId, endpointId) {
  loadingPackages.value = true
  packageList.value = []
  try {
    const { data } = await getPackages({ project_id: projectId, endpoint_id: endpointId })
    packageList.value = data.list || []
  } catch (e) {
    ElMessage.error('加载代码包失败')
    console.error(e)
  } finally {
    loadingPackages.value = false
  }
}

function onPackageSelect(pkg) {
  selectedPackage.value = pkg
}

// =====================================================
// 拉取
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
    text: `⏳ 正在部署 ${pkg.full_name}\n目标: ${proj.name} (${ep.name})\n(大概 3-5 秒,请稍候...)`
  }
  try {
    const { data } = await pullPackage(pkg.id)
    if (data.success) {
      result.value = {
        type: 'success',
        title: '拉取成功',
        text: `✓ 部署成功\n代码包: ${pkg.full_name} (${pkg.build_time})\n目标: ${proj.name} (${ep.name})\n耗时: ${(data.time_cost || 0).toFixed(2)}s`
      }
    } else {
      result.value = {
        type: 'error',
        title: '拉取失败',
        text: `✗ 部署失败\n代码包: ${pkg.full_name} (${pkg.build_time})\n目标: ${proj.name} (${ep.name})\n错误: ${data.err || '未知错误'}`
      }
    }
  } catch (e) {
    result.value = {
      type: 'error',
      title: '请求失败',
      text: `✗ 部署失败\n错误: ${e?.msg || e?.message || '请求失败'}`
    }
  } finally {
    pulling.value = false
  }
}

// =====================================================
// 上传
// =====================================================
function emptyUploadForm() {
  return {
    projectId: '',
    endpoint: '',
    note: ''
  }
}

function openUploadDialog() {
  uploadForm.value = emptyUploadForm()
  // 预填当前选中的项目+端
  if (selectedProject.value) {
    uploadForm.value.projectId = selectedProject.value.id
    if (selectedEndpoint.value) {
      uploadForm.value.endpoint = selectedEndpoint.value.endpoint.name
    }
  }
  uploadFile.value = null
  selectedFiles.value = []
  packingProgress.value = 0
  uploadDialogVisible.value = true
  // 等 DOM 渲染完,同步 webkitdirectory 属性
  nextTick(() => syncWebkitDirectory())
}

function onUploadProjectChange() {
  uploadForm.value.endpoint = ''
  clearSelected()
}

function onUploadEndpointChange() {
  // 切换端时清掉已选文件(单/文件夹模式互斥)
  clearSelected()
  nextTick(() => syncWebkitDirectory())
}

// native input 选完文件后,native change 事件
// 只走点击选择,不走拖拽(浏览器对文件夹拖拽支持差,webRelativePath 不可靠)
function onNativeFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return
  if (isFolderMode.value) {
    // 文件夹模式:累加所有文件
    const added = []
    files.forEach(f => {
      if (!selectedFiles.value.find(x => x.name === f.name && x.size === f.size)) {
        selectedFiles.value.push(f)
        added.push(f)
      }
    })
    // 检查 0 字节文件
    const empty = added.filter(f => f.size === 0)
    if (empty.length > 0 && empty.length === added.length) {
      ElMessage.warning(`所选文件夹里 ${empty.length} 个文件都是 0 字节,无法上传`)
    } else if (empty.length > 0) {
      ElMessage.warning(`已忽略 ${empty.length} 个 0 字节文件`)
    }
  } else {
    // 单文件模式:只取第一个
    uploadFile.value = files[0]
    if (files[0].size === 0) {
      ElMessage.warning('所选文件是 0 字节,无法上传')
    }
  }
  checkSizeLimit()
}

function clearSelected() {
  selectedFiles.value = []
  uploadFile.value = null
  packingProgress.value = 0
  // 清空 input 的 value,允许选同一个
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

// 同步 webkitdirectory 属性到 native input(Vue 模板渲染不靠谱,手动设)
function syncWebkitDirectory() {
  const input = fileInputRef.value
  if (!input) return
  if (isFolderMode.value) {
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    input.setAttribute('mozdirectory', '')
    input.setAttribute('multiple', '')
  } else {
    input.removeAttribute('webkitdirectory')
    input.removeAttribute('directory')
    input.removeAttribute('mozdirectory')
    input.removeAttribute('multiple')
  }
}

// 拖拽已禁用(浏览器对文件夹拖拽支持差,file 引用易失效)
// 只走点击选择 → fileInputRef.click() → 浏览器弹文件选择器 → onNativeFileChange

function checkSizeLimit() {
  const total = isFolderMode.value
    ? selectedFiles.value.reduce((sum, f) => sum + (f.size || 0), 0)
    : (uploadFile.value?.size || 0)
  if (total > FOLDER_SIZE_LIMIT) {
    ElMessage.warning(
      isFolderMode.value
        ? `文件夹总大小 ${(total / 1024 / 1024).toFixed(1)}MB 超过 300MB 限制,请清理后再选`
        : `文件 ${(total / 1024 / 1024).toFixed(1)}MB 超过 300MB 限制`
    )
    // 自动清掉,避免误传
    clearSelected()
    return false
  }
  return true
}

// 文件夹模式 → JSZip 打包成 Blob
// 关键:提前 await file.arrayBuffer() 把 file 转成内存 ArrayBuffer,
//       不依赖原 file 引用(input.value 清空后 file 引用会失效)
// 同时给重名文件加序号(拖拽多文件场景下 webkitRelativePath 可能是空,fallback 到 name 会撞)
async function packFolderToZip() {
  if (selectedFiles.value.length === 0) return null
  packing.value = true
  packingProgress.value = 0
  const zip = new JSZip()
  const total = selectedFiles.value.length
  const usedNames = new Set()
  for (let i = 0; i < total; i++) {
    const f = selectedFiles.value[i]
    let rel = f.webkitRelativePath || f.name
    if (!rel) rel = `file_${i}`
    // 防止重名:加序号后缀
    let unique = rel
    let n = 1
    while (usedNames.has(unique)) {
      const dot = rel.lastIndexOf('.')
      unique = dot > 0
        ? `${rel.slice(0, dot)}_${n}${rel.slice(dot)}`
        : `${rel}_${n}`
      n++
    }
    usedNames.add(unique)
    // 关键:把 file 读成 ArrayBuffer,避免后续 file 引用失效
    const buf = await f.arrayBuffer()
    zip.file(unique, buf)
    packingProgress.value = Math.round(((i + 1) / total) * 100)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  packing.value = false
  return blob
}

function validateUpload() {
  if (!uploadForm.value.projectId) { ElMessage.warning('请选择所属项目'); return false }
  if (!uploadForm.value.endpoint) { ElMessage.warning('请选择所属端'); return false }
  if (isFolderMode.value && selectedFiles.value.length === 0) {
    ElMessage.warning('请选择要上传的文件夹')
    return false
  }
  if (!isFolderMode.value && !uploadFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return false
  }
  return true
}

async function confirmUpload() {
  if (!validateUpload()) return
  if (!checkSizeLimit()) return

  const ep = endpointOptionsForProject.value.find(e => e.name === uploadForm.value.endpoint)

  try {
    let fileToUpload
    let displayName

    if (isFolderMode.value) {
      // 文件夹模式 → JSZip 打包
      ElMessage.info(`正在打包 ${selectedFiles.value.length} 个文件...`)
      const zipBlob = await packFolderToZip()
      if (!zipBlob) {
        ElMessage.error('打包失败')
        return
      }
      // 把 zipBlob 包成 File,用 folderName 当文件名
      fileToUpload = new File([zipBlob], `${folderName.value || 'package'}.zip`, {
        type: 'application/zip'
      })
      displayName = folderName.value
    } else {
      // 单文件模式
      fileToUpload = uploadFile.value
      displayName = fileToUpload.name.replace(/\.[^.]+$/, '')
    }

    uploading.value = true
    const fd = new FormData()
    fd.append('file', fileToUpload)
    fd.append('project_id', String(uploadForm.value.projectId))
    fd.append('endpoint_id', String(ep.id))
    // 包名:文件夹用 folderName,单文件用文件名去后缀
    fd.append('name', displayName)
    if (uploadForm.value.note) fd.append('note', uploadForm.value.note)
    // build_time / uploader 由后端从 token 自动生成(当前时间 + user_id)

    const { data: newPkg } = await uploadPackage(fd)
    ElMessage.success(`上传成功: ${newPkg.full_name}`)
    uploadDialogVisible.value = false
    // 如果当前选中的项目+端 == 新包归属 → 刷新代码包列表
    if (selectedProject.value?.id === newPkg.project_id
        && selectedEndpoint.value?.endpoint?.id === newPkg.endpoint_id) {
      packageList.value = [newPkg, ...packageList.value]
      selectedPackage.value = newPkg
    }
    // 问是否立即部署
    const proj = treeData.value.find(t => t.id === newPkg.project_id)
    ElMessageBox.confirm(
      `代码包 ${newPkg.full_name} 已上传。是否立即部署到 ${proj?.name} (${uploadForm.value.endpoint})?`,
      '部署提示',
      { confirmButtonText: '立即部署', cancelButtonText: '稍后', type: 'success' }
    ).then(() => {
      if (proj) selectedProject.value = proj
      selectedEndpoint.value = {
        name: uploadForm.value.endpoint,
        endpoint: ep,
        project: proj
      }
      selectedPackage.value = newPkg
      if (!packageList.value.some(x => x.id === newPkg.id)) {
        loadPackages(newPkg.project_id, newPkg.endpoint_id)
      }
    }).catch(() => { /* 稍后 */ })
  } catch (e) {
    console.error('[confirmUpload] failed:', e)
    const detail = e?.msg || e?.message || (typeof e === 'string' ? e : '网络异常')
    ElMessage.error(`上传失败: ${detail}`)
  } finally {
    uploading.value = false
    packing.value = false
    packingProgress.value = 0
  }
}

onMounted(async () => {
  await loadAllEndpoints()
  await loadTree()
})
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
              <el-button
                size="small"
                :icon="Refresh"
                @click="loadTree"
                :loading="treeLoading"
              >
                刷新
              </el-button>
            </div>
          </div>
        </template>

        <el-input
          v-model="filterText"
          placeholder="🔍 搜索项目或端"
          clearable
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
          empty-text="暂无项目,点击「上传代码包」或到 admin_menus 配置"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <template v-if="String(data.id).startsWith('project:')">
                <el-icon :size="14" class="node-icon project">
                  <Folder />
                </el-icon>
                <span class="node-label">{{ node.label }}</span>
                <el-tag size="small" type="info" effect="plain" class="node-meta">
                  {{ data.raw.endpoints?.length || 0 }} 端
                </el-tag>
              </template>
              <template v-else>
                <el-icon :size="14" class="node-icon endpoint">
                  <component :is="resolveIcon(data.raw.endpoint.icon)" />
                </el-icon>
                <span class="node-label">{{ node.label }}</span>
                <span class="node-meta">.{{ data.raw.endpoint.ext }}</span>
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
            <el-descriptions-item label="项目编码">
              <span class="mono">{{ selectedProject.code }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="端数量">
              {{ selectedProject.endpoints?.length || 0 }} 个
              <span v-if="selectedProject.endpoints?.length" class="meta-inline">
                ({{ selectedProject.endpoints.map(e => e.name).join('、') }})
              </span>
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
              <component :is="resolveIcon(selectedEndpoint.endpoint.icon)" />
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
              <el-table-column prop="full_name" label="包名" min-width="220" show-overflow-tooltip />
              <el-table-column prop="build_time" label="构建时间" width="170" />
              <el-table-column label="大小" width="90">
                <template #default="{ row }">
                  {{ row.size ? (row.size / 1024 / 1024).toFixed(1) + 'MB' : '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
            </el-table>

            <div v-if="selectedPackage" class="selected-pkg">
              <el-icon :size="16" color="#67c23a"><Connection /></el-icon>
              <span>已选: <strong>{{ selectedPackage.full_name }}</strong> · {{ selectedPackage.build_time }}</span>
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
              v-for="p in projectsForSelect"
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
            @change="onUploadEndpointChange"
          >
            <el-option
              v-for="ep in endpointOptionsForProject"
              :key="ep.id"
              :label="`${ep.name}  (.${ep.ext})`"
              :value="ep.name"
            />
          </el-select>
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
          <div class="upload-drag" @click="triggerFileInput">
            <input
              ref="fileInputRef"
              type="file"
              style="display: none"
              @change="onNativeFileChange"
            />
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="upload-text">
              <template v-if="isFolderMode">
                <em>点击选择文件夹</em>(整目录自动打包成 zip)
              </template>
              <template v-else>
                <em>点击选择文件</em>
              </template>
            </div>
            <div class="upload-tip">
              <template v-if="packing">
                <el-progress :percentage="packingProgress" :stroke-width="14" />
                <span style="margin-left: 8px;">正在打包... {{ packingProgress }}%</span>
              </template>
              <template v-else>
                <template v-if="isFolderMode">
                  <template v-if="selectedFiles.length > 0">
                    已选文件夹: <strong>{{ folderName }}</strong> · {{ selectedFiles.length }} 个文件 ·
                    {{ totalSizeMB.toFixed(2) }}MB
                    <el-button link type="danger" size="small" @click.stop="clearSelected">清空</el-button>
                  </template>
                  <template v-else>
                    支持 Chrome / Edge(整目录自动打包成 zip)
                  </template>
                </template>
                <template v-else>
                  <template v-if="uploadFile">
                    已选: <strong>{{ uploadFile.name }}</strong> · {{ totalSizeMB.toFixed(2) }}MB
                    <el-button link type="danger" size="small" @click.stop="clearSelected">清空</el-button>
                  </template>
                  <template v-else>
                    支持任意后缀,iOS 选 .ipa / 安卓选 .apk
                  </template>
                </template>
              </template>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="uploading || packing"
          :disabled="!canUpload"
          @click="confirmUpload"
        >
          {{ packing ? '打包中...' : '确认上传' }}
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
  gap: 8px;
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

.meta-inline {
  color: #909399;
  font-size: 12px;
  margin-left: 4px;
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

.upload-drag {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  padding: 24px 20px;
  text-align: center;
  cursor: pointer;
  background: #fafafa;
  transition: border-color 0.2s;
}

.upload-drag:hover {
  border-color: #409eff;
}

.upload-drag .el-icon--upload {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 8px;
}

.upload-drag .upload-text {
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
}

.upload-drag .upload-text em {
  color: #409eff;
  font-style: normal;
  font-weight: 600;
  margin: 0 2px;
}

.upload-drag .upload-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
  min-height: 20px;
}
</style>
