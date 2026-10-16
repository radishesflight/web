<!--
  代码拉取控制台(Online)

  还原 F:/work/go/test/cs/index.html 的页面,移植到 Vue 3 + Element Plus。
  当前用假数据,后续对接后端时:
   - assets  → GET /api/codeDeploy/assets
   - projects → GET /api/codeDeploy/assets/:id/projects
   - pull    → POST /api/codeDeploy/assets/:id/git-pull
  第 3 步"上传代码包"参照 ApkPackage.vue 的文件夹上传:
   选文件夹 → JSZip 整目录打包 → 拉取时随包部署
-->
<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Tools, Refresh, Promotion, UploadFilled } from '@element-plus/icons-vue'
import JSZip from 'jszip'
import { getAssets, getAssetPaths, uploadPackage, pullPackage } from '@/api/codeDeploy'

// 前端文件夹总大小限制(与 ApkPackage.vue 一致)
const FOLDER_SIZE_LIMIT = 300 * 1024 * 1024

// =====================================================
// 状态
// =====================================================
// 资产数据从后端 /api/codeDeploy/assets 拉(business_assets 表,status=1)
// 字段(后端 formatAsset 返回):id, project_id, jms_id, name, address, platform, os, protocol, port, comment, status
const allAssets = ref([])
const loadingAssets = ref(false)
const filter = ref('')
const selectedAsset = ref(null) // {id, name, address, project_id, ...}
const projectOptions = ref([])
const loadingProjects = ref(false)
const selectedProject = ref(null) // {id, name, path} — 第 2 步选中的资产路径
// 第 3 步:上传代码包(文件夹模式,参照 ApkPackage.vue)
//   选文件夹 → JSZip 整目录打包 → 上传到对象存储 → 后端落库 deploy_targets
//   拉取时再 POST /api/codeDeploy/packages/:id/pull(下一步做)
const uploadedPackage = ref(null)   // 后端返回的 package 实体:{id, full_name, file_url, size, name, asset_id, asset_path_id, ...}
const selectedFiles = ref([])       // 文件夹模式的文件列表
const packing = ref(false)          // JSZip 打包中
const packingProgress = ref(0)      // 打包进度 0~100
const uploading = ref(false)        // POST /api/codeDeploy/packages 上传中
const fileInputRef = ref(null)      // native input 引用,手动设 webkitdirectory
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
    (a.name || '').toLowerCase().includes(q) ||
    (a.address || '').toLowerCase().includes(q)
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
  !!(selectedAsset.value && selectedProject.value && uploadedPackage.value && !pulling.value && !packing.value)
)

// 第 2 步下拉 placeholder:跟着 3 种状态走
//  - 没选资产 → 提示先选资产
//  - 已选资产但还在加载路径 → 提示正在加载
//  - 加载完了 → 提示选择项目
const projectPlaceholder = computed(() => {
  if (!selectedAsset.value) return '-- 请先选资产 --'
  if (loadingProjects.value) return '正在加载项目路径...'
  return '请选择要拉取的项目路径'
})

// =====================================================
// 操作
// =====================================================
async function loadAssets() {
  loadingAssets.value = true
  try {
    const { data } = await getAssets()
    allAssets.value = data?.list || []
  } catch (e) {
    console.error('[loadAssets] failed:', e)
    const detail = e?.msg || e?.message || '网络异常'
    ElMessage.error(`加载资产列表失败: ${detail}`)
    allAssets.value = []
  } finally {
    loadingAssets.value = false
  }
}

function selectAsset(asset) {
  selectedAsset.value = asset
  // 重置项目 + 已上传包
  selectedProject.value = null
  uploadedPackage.value = null
  selectedFiles.value = []
  result.value = null
  loadProjects(asset)
}

function reselectAsset() {
  selectedAsset.value = null
  selectedProject.value = null
  uploadedPackage.value = null
  selectedFiles.value = []
  projectOptions.value = []
  result.value = null
}

// 第 2 步:从选中的资产找它所属项目下的可拉取目录(BusinessAssetPaths 表)
// 业务侧:资产下的路径是人工维护的,每条对应一个可 pull 的目录
// 字段(后端 formatAssetPath 返回):id, asset_id, name(展示名,前端用), path(实际路径)
async function loadProjects(asset) {
  loadingProjects.value = true
  projectOptions.value = []
  try {
    const { data } = await getAssetPaths(asset.id)
    const paths = data?.list || []
    // 塑成下拉用的 {id, name, path}:id 给上传接口用,name 用于下拉展示(可空,fallback 到 path)
    projectOptions.value = paths.map(p => ({
      id: p.id,
      name: p.name || p.path,
      path: p.path
    }))
  } catch (e) {
    console.error('[loadProjects] failed:', e)
    const detail = e?.msg || e?.message || '网络异常'
    ElMessage.error(`加载项目列表失败: ${detail}`)
    projectOptions.value = []
  } finally {
    loadingProjects.value = false
  }
}

function onProjectChange(option) {
  // option = {id, name, path} 或 null
  if (!option) {
    uploadedPackage.value = null
    selectedFiles.value = []
    return
  }
  // 重新选了项目 → 清掉之前上传的包(包是跟着项目走的)
  uploadedPackage.value = null
  selectedFiles.value = []
}

// =====================================================
// 第 3 步:上传代码包(文件夹模式,参照 ApkPackage.vue)
// =====================================================
function triggerFileInput() {
  if (!selectedProject.value) return
  fileInputRef.value?.click()
}

// 同步 webkitdirectory 属性到 native input(Vue 模板渲染不靠谱,手动设)
// 本页只有文件夹模式(整目录打包成 zip)
function syncWebkitDirectory() {
  const input = fileInputRef.value
  if (!input) return
  input.setAttribute('webkitdirectory', '')
  input.setAttribute('directory', '')
  input.setAttribute('mozdirectory', '')
  input.setAttribute('multiple', '')
}

// native input 选完文件后触发:整目录替换 + 大小检查 + 自动打包
function onNativeFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return
  // 清空 input 的 value,允许选同一个文件夹
  if (fileInputRef.value) fileInputRef.value.value = ''

  // 大小限制
  const total = files.reduce((sum, f) => sum + (f.size || 0), 0)
  if (total > FOLDER_SIZE_LIMIT) {
    ElMessage.warning(`文件夹总大小 ${(total / 1024 / 1024).toFixed(1)}MB 超过 300MB 限制,请清理后再选`)
    clearUploaded()
    return
  }

  // 0 字节检查
  const empty = files.filter(f => f.size === 0)
  if (empty.length === files.length) {
    ElMessage.warning(`所选文件夹里 ${empty.length} 个文件都是 0 字节,无法上传`)
    clearUploaded()
    return
  }
  if (empty.length > 0) {
    ElMessage.warning(`已忽略 ${empty.length} 个 0 字节文件`)
  }

  selectedFiles.value = files
  uploadedPackage.value = null
  // 打包完成后自动接上"上传到对象存储"——无需手动点按钮
  packSelectedFolder().then(() => {
    if (localZip.value) handleUpload()
  })
}

function clearUploaded() {
  selectedFiles.value = []
  uploadedPackage.value = null
  localZip.value = null
  packing.value = false
  packingProgress.value = 0
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// 暂存"本地 zip"(JSZip 打包产物,等用户点"上传"按钮再 POST 出去)
const localZip = ref(null)          // {folderName, fileCount, sizeMB, blob, fileName}

async function packSelectedFolder() {
  if (selectedFiles.value.length === 0) return
  packing.value = true
  packingProgress.value = 0
  try {
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
      const buf = await f.arrayBuffer()
      zip.file(unique, buf)
      packingProgress.value = Math.round(((i + 1) / total) * 100)
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const folderName = (selectedFiles.value[0].webkitRelativePath || '').split('/')[0] || 'package'
    localZip.value = {
      folderName,
      fileCount: total,
      sizeMB: (blob.size / 1024 / 1024).toFixed(2),
      blob,
      fileName: `${folderName}.zip`
    }
  } finally {
    packing.value = false
  }
}

// 把 localZip 自动推到后端(后端推到对象存储 + 落库 deploy_targets)
// 选完文件夹后由 onNativeFileChange 末尾自动调,无需手动按钮
async function handleUpload() {
  if (!localZip.value) {
    ElMessage.warning('请先选择要上传的文件夹')
    return
  }
  if (!selectedProject.value || !selectedAsset.value) {
    ElMessage.warning('请先选资产和项目路径')
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', new File([localZip.value.blob], localZip.value.fileName, { type: 'application/zip' }))
    fd.append('asset_id', String(selectedAsset.value.id))
    // asset_path_id:有选中路径就传,没选传 0
    fd.append('asset_path_id', String(selectedProject.value.id || 0))
    fd.append('name', localZip.value.folderName)
    fd.append('note', '')

    const { data: pkg } = await uploadPackage(fd)
    uploadedPackage.value = pkg
    ElMessage.success(`上传成功: ${pkg.full_name || pkg.name}`)
  } catch (e) {
    console.error('[handleUpload] failed:', e)
    const detail = e?.msg || e?.message || '网络异常'
    ElMessage.error(`上传失败: ${detail}`)
    // 失败时把已打包的 localZip 清掉,回到"未选"状态,允许重新选目录再自动重传
    localZip.value = null
    selectedFiles.value = []
  } finally {
    uploading.value = false
  }
}

async function handlePull() {
  if (!canPull.value) return
  const id = selectedAsset.value.id
  const proj = selectedProject.value
  const pkg = uploadedPackage.value
  pulling.value = true
  result.value = {
    type: 'info',
    title: '执行中',
    text: `⏳ 正在部署代码包 ${pkg.full_name || pkg.name} (${(pkg.size / 1024 / 1024).toFixed(2)}MB)\n目标: ${selectedAsset.value.name} (${selectedAsset.value.address}) @ ${proj.path}\n(后端正在调用 JumpServer 拉起 ad-hoc 任务,内部轮询直到部署完成,可能 1-3 分钟)`
  }
  try {
    // 真实调用:后端生成 OSS 签名 URL + 调 JMS ad-hoc 任务 + 内部轮询到终态
    // 5 分钟 axios timeout,跟 uploadPackage 一致
    const { data: res } = await pullPackage(pkg.id)
    const timeCost = (res.time_cost || 0).toFixed(2)
    const lines = []
    lines.push(`✓ 部署成功`)
    lines.push(`代码包: ${res.full_name || pkg.full_name}`)
    lines.push(`目标: ${res.asset_name || selectedAsset.value.name} @ ${res.deploy_path || proj.path}`)
    lines.push(`耗时: ${timeCost}s(JMS 任务端到端)`)
    if (res.status) lines.push(`JMS 状态: ${res.status}`)
    if (res.material) {
      lines.push('--- 远端 stdout ---')
      lines.push(res.material.trim())
    }
    result.value = {
      type: 'success',
      title: '拉取成功',
      text: lines.join('\n')
    }
    pushRecent(id)
  } catch (e) {
    // 部署失败时,后端会带 data(有 material/err),但 axios 拦截器默认只 reject error 对象
    // 实际拿不到 res,得在 catch 里根据 e 推断
    const detail = e?.msg || e?.message || '网络异常'
    const lines = []
    lines.push(`✗ 部署失败`)
    lines.push(`代码包: ${pkg.full_name || pkg.name}`)
    lines.push(`目标: ${selectedAsset.value.name} (${selectedAsset.value.address}) @ ${proj.path}`)
    lines.push(`错误: ${detail}`)
    // 如果后端带了 material(strip 末段),也展示出来,辅助排错
    if (e?.data?.material) {
      lines.push('--- 远端 stdout(末段) ---')
      lines.push(e.data.material.trim().split('\n').slice(-30).join('\n'))
    }
    if (e?.data?.err) {
      lines.push(`后端 err: ${e.data.err}`)
    }
    result.value = {
      type: 'error',
      title: '拉取失败',
      text: lines.join('\n')
    }
  } finally {
    pulling.value = false
  }
}

onMounted(() => {
  loadRecents()
  loadAssets()
  // 等 DOM 渲染完,同步 webkitdirectory 属性(只支持文件夹选择)
  nextTick(() => syncWebkitDirectory())
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
          placeholder="🔍 搜索资产名或地址 (如:点药 / 47.104)..."
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
            <span class="ip">{{ asset.address }}</span>
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
            <span class="sel-value mono">{{ selectedAsset.address }}</span>
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
        value-key="id"
        :placeholder="projectPlaceholder"
        :disabled="!selectedAsset || loadingProjects"
        :loading="loadingProjects"
        @change="onProjectChange"
        style="width: 100%"
        size="default"
      >
        <el-option
          v-for="p in projectOptions"
          :key="p.id"
          :label="`${p.name}  (${p.path})`"
          :value="p"
        />
        <el-option
          v-if="selectedAsset && !loadingProjects && projectOptions.length === 0"
          disabled
          label="该资产没有配置可拉取的项目"
        />
      </el-select>

      <el-divider />

      <!-- 3. 上传代码包 -->
      <div class="field-label">
        <span class="num">3.</span>
        <span>上传代码包</span>
        <span v-if="localZip && !uploadedPackage" class="count-text">已打包 {{ localZip.fileCount }} 个文件</span>
        <span v-if="uploadedPackage" class="count-text">已上传 1 个</span>
      </div>
      <div
        class="upload-drag"
        :class="{ disabled: !selectedProject || packing }"
        @click="triggerFileInput"
      >
        <input
          ref="fileInputRef"
          type="file"
          style="display: none"
          @change="onNativeFileChange"
        />
        <template v-if="!uploadedPackage && !packing">
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="upload-text">
            <em>点击选择文件夹</em>(整目录自动打包成 zip 后部署)
          </div>
        </template>
        <div class="upload-tip">
          <template v-if="packing">
            <el-progress :percentage="packingProgress" :stroke-width="14" style="flex: 1; max-width: 320px;" />
            <span style="margin-left: 8px;">正在打包... {{ packingProgress }}%</span>
          </template>
          <template v-else-if="uploadedPackage">
            ✓ 已上传到对象存储: <strong>{{ uploadedPackage.full_name || uploadedPackage.name }}</strong>
            · {{ (uploadedPackage.size / 1024 / 1024).toFixed(2) }}MB
            <span class="reselect-hint">(点击可重新选择)</span>
          </template>
          <template v-else-if="localZip">
            已打包: <strong>{{ localZip.fileName }}</strong>
            · {{ localZip.fileCount }} 个文件
            · {{ localZip.sizeMB }}MB
            <span class="reselect-hint">(点击可重新选择)</span>
          </template>
          <template v-else>文件夹总大小不超过 300MB{{ selectedProject ? '' : ',请先选择项目' }}</template>
        </div>
      </div>
      <div v-if="uploading" style="margin-top: 8px; color: var(--el-color-primary); font-size: 12px;">
        <el-icon class="is-loading"><Promotion /></el-icon>
        正在上传到对象存储...
      </div>
      <div v-else-if="uploadedPackage && !packing" style="margin-top: 8px;">
        <el-button size="small" plain @click="clearUploaded" :icon="Refresh">重新选择</el-button>
      </div>

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

/* ---- 第 3 步:上传代码包(与 ApkPackage.vue 风格一致) ---- */
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

.upload-drag.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-drag.disabled:hover {
  border-color: #d9d9d9;
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

.upload-drag .reselect-hint {
  color: #c0c4cc;
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
