<!--
  APK包管理 页面(2026-10-16)

  布局:左侧项目树(项目 → 资产 → 路径 三层),右侧详情(选中项目/资产显示元信息,
  选中资产路径显示该路径下所有历史安装包 + 上传入口)。

  接口:
   - GET  /api/codeDeploy/projects-with-paths  左侧树
   - GET  /api/codeDeploy/packages?asset_path_id=X  右侧包列表
   - POST /api/codeDeploy/packages  上传(multipart,asset_id + asset_path_id + file)
        后端按 asset_path.type 做白名单:apk → .apk;ios → .ipa/.plist;web → .zip
        安装包大小上限 500MB(web zip 仍 200MB)
   - DELETE /api/codeDeploy/packages/:id  删除

  权限:走 PermissionMiddleware,前端按钮用 hasRoute 决定显隐。

  与前端包管理(ApkPackage)的区别:这里只展示 type=apk/ios 路径,
  上传是单文件直传,不做 JSZip 打包,不部署。
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, UploadFilled, Promotion, Delete, Download } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getProjectsWithPaths, getPackages, uploadPackage, deletePackage, getPackageDownloadURL } from '@/api/codeDeploy'

const userStore = useUserStore()

// 状态
const projectTree = ref([])
const loadingTree = ref(false)
const filterText = ref('')
const fileInputRef = ref(null)
const selectedNode = ref(null)          // {kind: 'project'|'asset'|'path', data: {...}}
const packages = ref([])
const loadingPackages = ref(false)
const uploading = ref(false)

// 当前选中路径的类型(apk / ios),用于决定上传 accept + 按钮文案
// 2026-10-16 改造:APK包管理 只走 apk/ios 单文件直传,不再做 JSZip 打包
const currentPathType = computed(() => {
  if (selectedNode.value && selectedNode.value.kind === 'path') {
    return (selectedNode.value.data && selectedNode.value.data.type) || ''
  }
  return ''
})
// accept 列表(2026-10-16):按路径类型给浏览器筛文件
const acceptStr = computed(() => {
  if (currentPathType.value === 'apk') return '.apk,application/vnd.android.package-archive'
  if (currentPathType.value === 'ios') return '.ipa,application/octet-stream,.plist,application/xml,text/xml'
  return '*'
})
// 按钮文案:跟随类型动态切换
const uploadBtnText = computed(() => {
  if (currentPathType.value === 'apk') return '上传 APK'
  if (currentPathType.value === 'ios') return '上传 iOS 包'
  return '上传安装包'
})
// 安装包大小上限(2026-10-16):apk/ios 放宽到 500MB,与后端 maxInstallPackageSize 对齐
const INSTALL_PACKAGE_SIZE_LIMIT = 500 * 1024 * 1024

// 把 projectTree 转成 el-tree 结构(统一 children 字段,让 el-tree 能递归展开)
//   project.children = [assets...]
//   asset.children   = [paths...] (path 节点带 _isPath + _asset_id 标记)
//   path             = 叶子
// 路径类型过滤(2026-10-16):APK包管理 只展示 type='apk' 或 type='ios' 的路径
//   type 字段:string enum "api" / "web" / "other" / "apk" / "ios",DB default 'web'
//   老的 NULL 数据不显示(用户确认"老的不考虑")
const treeData = computed(() => {
  let projects = projectTree.value
  if (filterText.value.trim()) {
    const q = filterText.value.trim().toLowerCase()
    projects = projects.filter(function (p) {
      if ((p.name || '').toLowerCase().includes(q)) return true
      const assets = p.assets || []
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i]
        if ((a.name || '').toLowerCase().includes(q)) return true
        if ((a.address || '').toLowerCase().includes(q)) return true
        const paths = a.paths || []
        for (let j = 0; j < paths.length; j++) {
          if ((paths[j].name || '').toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }
  return projects.map(function (p) {
    return {
      ...p,
      children: (p.assets || []).map(function (a) {
        return {
          ...a,
          // 只显示 type='apk' 或 type='ios' 的路径,老的 NULL 不显示
          children: (a.paths || []).filter(function (pa) {
            return pa.type === 'apk' || pa.type === 'ios'
          }).map(function (pa) {
            return Object.assign({}, pa, { _isPath: true, _asset_id: a.id })
          })
        }
      })
    }
  })
})

// 当前选中路径的 id(用于拉包列表)
const selectedPathID = computed(function () {
  if (selectedNode.value && selectedNode.value.kind === 'path') {
    return selectedNode.value.data.id
  }
  return 0
})

// 权限
const canDelete = computed(function () {
  return userStore.hasRoute('DELETE', '/api/codeDeploy/packages/:id')
})
const canDownload = computed(function () {
  return userStore.hasRoute('GET', '/api/codeDeploy/packages/:id/download-url')
})

// 加载
async function loadTree() {
  loadingTree.value = true
  try {
    const { data } = await getProjectsWithPaths()
    projectTree.value = (data && data.list) || []
  } catch (e) {
    console.error('[ApkPackage] loadTree failed:', e)
    ElMessage.error('加载项目树失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
    projectTree.value = []
  } finally {
    loadingTree.value = false
  }
}

async function loadPackagesForPath() {
  if (!selectedPathID.value) {
    packages.value = []
    return
  }
  loadingPackages.value = true
  try {
    const { data } = await getPackages({ asset_path_id: selectedPathID.value })
    packages.value = (data && data.list) || []
  } catch (e) {
    console.error('[ApkPackage] loadPackages failed:', e)
    ElMessage.error('加载包列表失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
    packages.value = []
  } finally {
    loadingPackages.value = false
  }
}

// 自定义 el-tree 节点渲染,只显示名称
function renderContent(h, ctx) {
  const data = ctx.data
  let kind = 'project'
  if (data && data._isPath) {
    kind = 'path'
  } else if (data && data.jms_id) {
    kind = 'asset'
  }
  if (data) data._kind = kind

  const label = (data && data.name) || '(无名)'
  return h('span', { class: 'tree-row tree-' + kind }, [label])
}

// 节点点击:区分项目 / 资产 / 路径
function onNodeClick(data) {
  if (!data) return
  if (data._isPath) {
    selectedNode.value = { kind: 'path', data: data }
    loadPackagesForPath()
  } else if (data.jms_id) {
    selectedNode.value = { kind: 'asset', data: data }
    packages.value = []
  } else {
    selectedNode.value = { kind: 'project', data: data }
    packages.value = []
  }
}

// 上传(2026-10-16 改造):APK包管理 单文件直传
//   apk 路径 → 选 .apk   (Android 安装包)
//   ios 路径 → 选 .ipa/.plist (iOS 安装包 + OTA 清单)
//   不再做 JSZip 打包;不带 webdirectory 属性
function triggerFilePicker() {
  if (!selectedPathID.value) {
    ElMessage.warning('请先在左侧选择一个资产路径')
    return
  }
  if (!currentPathType.value) {
    ElMessage.warning('当前路径缺少类型信息,无法确定可上传文件')
    return
  }
  fileInputRef.value && fileInputRef.value.click()
}

async function onNativeFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (fileInputRef.value) fileInputRef.value.value = ''
  if (files.length === 0) return
  if (files.length > 1) {
    ElMessage.warning('只允许上传 1 个安装包')
    return
  }
  const file = files[0]
  if (file.size === 0) {
    ElMessage.warning('文件为空,无法上传')
    return
  }
  // 前端大小兜底(后端也会再校验一次)
  if (file.size > INSTALL_PACKAGE_SIZE_LIMIT) {
    ElMessage.warning(
      '安装包大小 ' + (file.size / 1024 / 1024).toFixed(1) +
      'MB 超过 ' + (INSTALL_PACKAGE_SIZE_LIMIT / 1024 / 1024) + 'MB 限制'
    )
    return
  }

  // 找所属资产(用于填 asset_id)
  const pathNode = selectedNode.value.data
  const assetID = pathNode._asset_id || pathNode.asset_id
  const assetNode = findAssetById(assetID)
  if (!assetNode) {
    ElMessage.error('内部错误:找不到所属资产')
    return
  }

  // name 优先用 file.name(去掉扩展名),回退到 pathNode.name
  const dot = file.name.lastIndexOf('.')
  const baseName = dot > 0 ? file.name.slice(0, dot) : file.name

  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('asset_id', String(assetNode.id))
    fd.append('asset_path_id', String(pathNode.id))
    fd.append('name', baseName || pathNode.name || 'package')
    fd.append('note', '')
    await uploadPackage(fd)
    ElMessage.success('上传成功: ' + file.name)
    loadPackagesForPath()
  } catch (err) {
    console.error('[ApkManagement] upload failed:', err)
    ElMessage.error('上传失败: ' + ((err && (err.msg || err.message)) || '网络异常'))
  } finally {
    uploading.value = false
  }
}

function findAssetById(id) {
  for (let i = 0; i < projectTree.value.length; i++) {
    const p = projectTree.value[i]
    const assets = p.assets || []
    for (let j = 0; j < assets.length; j++) {
      if (assets[j].id === id) return assets[j]
    }
  }
  return null
}

// 下载包:走后端 getPackageDownloadURL 拿 OSS 签名 URL,再用 <a download> 触发浏览器下载
async function handleDownloadPackage(pkg) {
  if (!canDownload.value) {
    ElMessage.warning('当前角色无下载权限')
    return
  }
  try {
    const { data: url } = await getPackageDownloadURL(pkg.id)
    if (!url) {
      ElMessage.error('获取下载链接失败:返回为空')
      return
    }
    // 用动态 <a download> 触发(后端签名 URL 已带 Content-Disposition: attachment)
    const a = document.createElement('a')
    a.href = url
    a.download = pkg.full_name || pkg.name || ('package_' + pkg.id)
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (e) {
    console.error('[ApkPackage] download failed:', e)
    ElMessage.error('下载失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  }
}

// APK 包无需部署,跳过 handleDeployPackage
// 删除包
async function handleDeletePackage(pkg) {
  if (!canDelete.value) {
    ElMessage.warning('当前角色无删除权限')
    return
  }
  try {
    await ElMessageBox.confirm(
      '确认删除包 ' + (pkg.full_name || pkg.name) + '?DB 行会硬删,OSS 文件也会同步删。',
      '删除代码包',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await deletePackage(pkg.id)
    ElMessage.success('删除成功')
    loadPackagesForPath()
  } catch (e) {
    ElMessage.error('删除失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  }
}

// 工具
function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = Number(bytes)
  while (n >= 1024 && i < units.length - 1) { n = n / 1024; i++ }
  return n.toFixed(2) + ' ' + units[i]
}

function clearSelection() {
  selectedNode.value = null
  packages.value = []
}
void clearSelection  // 保留供以后需要清空选择时用(目前未绑定按钮)

onMounted(function () {
  loadTree()
})
</script>

<template>
  <div class="apk-package-page">
    <el-row :gutter="16">
      <el-col :xs="24" :md="10" :lg="9">
        <el-card shadow="never" class="left-card">
          <template #header>
            <div class="left-header">
              <span class="left-title">业务项目 / 端</span>
              <div class="left-actions">
                <el-button size="small" :icon="Refresh" @click="loadTree">刷新</el-button>
              </div>
            </div>
          </template>
          <el-input
            v-model="filterText"
            placeholder="搜索项目或端"
            :prefix-icon="Search"
            clearable
            class="search-box"
          />
          <el-tree
            v-loading="loadingTree"
            :data="treeData"
            :props="{ children: 'children', label: 'name' }"
            node-key="id"
            :render-content="renderContent"
            @node-click="onNodeClick"
            class="project-tree"
          />
          <input
            ref="fileInputRef"
            type="file"
            :accept="acceptStr"
            style="display: none"
            @change="onNativeFileChange"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="14" :lg="15">
        <el-card shadow="never" class="right-card">
          <template #header>
            <div class="right-header">
              <span class="right-title">详情</span>
              <el-button
                v-if="selectedNode && selectedNode.kind === 'path'"
                size="small"
                type="primary"
                :icon="UploadFilled"
                :loading="uploading"
                @click="triggerFilePicker"
              >{{ uploadBtnText }}</el-button>
            </div>
          </template>

          <div v-if="!selectedNode" class="empty">
            <el-alert
              type="info"
              :closable="false"
              title="请展开左侧该项目节点,选择具体路径(项目下资产/路径)以查看代码包"
            />
          </div>

          <div v-else-if="selectedNode.kind === 'project'" class="meta-block">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="项目 ID">{{ selectedNode.data.id }}</el-descriptions-item>
              <el-descriptions-item label="项目编码">{{ selectedNode.data.code }}</el-descriptions-item>
            </el-descriptions>
            <el-alert
              type="info"
              :closable="false"
              class="hint"
              title="请展开该项目节点,选择具体路径(项目下资产/路径)以查看代码包"
            />
          </div>

          <div v-else-if="selectedNode.kind === 'asset'" class="meta-block">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="资产 ID">{{ selectedNode.data.id }}</el-descriptions-item>
              <el-descriptions-item label="资产名称">{{ selectedNode.data.name }}</el-descriptions-item>
              <el-descriptions-item label="地址">{{ selectedNode.data.address || '-' }}</el-descriptions-item>
              <el-descriptions-item label="平台">{{ selectedNode.data.platform || '-' }} / {{ selectedNode.data.os || '-' }}</el-descriptions-item>
              <el-descriptions-item label="路径数">{{ (selectedNode.data.paths || []).length }} 条</el-descriptions-item>
            </el-descriptions>
            <el-alert
              type="info"
              :closable="false"
              class="hint"
              title="点击下方的路径节点查看对应的代码包"
            />
          </div>

          <div v-else-if="selectedNode.kind === 'path'" class="path-block">
            <div class="path-meta">
              <el-tag>路径 ID: {{ selectedNode.data.id }}</el-tag>
              <el-tag type="success">所属资产 ID: {{ selectedNode.data._asset_id || selectedNode.data.asset_id }}</el-tag>
              <span class="path-name">{{ selectedNode.data.name }}</span>
            </div>

            <div v-if="uploading" class="upload-status">
              <el-icon class="is-loading"><Promotion /></el-icon>
              正在上传到对象存储...
            </div>

            <el-table
              v-loading="loadingPackages"
              :data="packages"
              border
              stripe
              size="small"
              empty-text="该路径下还没有安装包,点击上方「上传 APK / iOS 包」按钮"
              class="package-table"
            >
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column prop="name" label="包名" width="140" />
              <el-table-column prop="full_name" label="完整名" min-width="200" show-overflow-tooltip />
              <el-table-column label="大小" width="100">
                <template #default="{ row }">{{ formatSize(row.size) }}</template>
              </el-table-column>
              <el-table-column label="上传时间" width="170">
                <template #default="{ row }">{{ row.build_time || row.created_at }}</template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 1" type="success" size="small">有效</el-tag>
                  <el-tag v-else type="info" size="small">已下架</el-tag>
                </template>
              </el-table-column>
              <el-table-column v-if="canDelete || canDownload" label="操作" width="160" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="canDownload"
                    size="small"
                    type="primary"
                    plain
                    :icon="Download"
                    @click="handleDownloadPackage(row)"
                  >下载</el-button>
                  <el-button
                    v-if="canDelete"
                    size="small"
                    type="danger"
                    plain
                    :icon="Delete"
                    @click="handleDeletePackage(row)"
                  >删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.apk-package-page { padding: 16px; }
.left-card, .right-card { min-height: 600px; }
.left-header, .right-header {
  display: flex; justify-content: space-between; align-items: center;
}
.left-title, .right-title { font-weight: 600; font-size: 15px; }
.left-actions { display: flex; gap: 8px; }
.search-box { margin-bottom: 12px; }
.project-tree { background: transparent; }
.tree-row {
  display: inline-flex; align-items: center; gap: 6px;
  width: 100%; font-size: 13px;
}
.tree-asset { color: var(--el-color-primary); }
.tree-path { color: var(--el-color-success); }
.empty, .meta-block, .path-block { padding: 4px 0; }
.meta-block .hint { margin-top: 16px; }
.path-meta {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px; flex-wrap: wrap;
}
.path-name { font-weight: 600; margin-left: 4px; }
.upload-status {
  display: flex; align-items: center; margin: 12px 0;
  color: var(--el-color-primary); font-size: 13px;
}
.package-table { margin-top: 8px; }
</style>
