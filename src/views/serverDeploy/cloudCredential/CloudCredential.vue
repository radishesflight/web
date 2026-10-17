<!--
  云平台凭证管理页面(2026-10-17 新增)
  增删改查云厂商(阿里云/腾讯云)的 AccessKey + SecretKey
  - secret_key 在列表里显示为 mask(只露后 4 位),防截屏泄露
  - 编辑时调详情接口拿明文 secret_key 预填表单
  - 同 name+type 唯一
-->
<template>
  <div class="cloud-credential-page">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <div class="header-left">
            <el-select
              v-model="filter.type"
              placeholder="所有厂商"
              style="width: 140px;"
              clearable
              @change="onFilterChange"
              @clear="onFilterChange"
            >
              <el-option label="阿里云" value="aliyun" />
              <el-option label="腾讯云" value="tencent" />
            </el-select>
            <el-input
              v-model="filter.keyword"
              placeholder="搜索 name / access_key"
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
              v-if="hasRoute('POST', '/api/serverDeploy/credentials')"
              type="warning"
              :icon="Plus"
              @click="openAddDialog"
            >新建凭证</el-button>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        size="small"
        empty-text="暂无凭证数据"
      >
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="备注名" min-width="180" show-overflow-tooltip />
        <el-table-column label="厂商" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'aliyun' ? 'warning' : 'success'" size="small">
              {{ row.type === 'aliyun' ? '阿里云' : row.type === 'tencent' ? '腾讯云' : (row.type || '-') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="access_key" label="AccessKey" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="ak-cell">{{ row.access_key }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="secret_key" label="SecretKey" min-width="220">
          <template #default="{ row }">
            <span class="sk-cell">{{ row.secret_key }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="hasRoute('PUT', `/api/serverDeploy/credentials/${row.id}`)"
              size="small"
              type="primary"
              link
              @click="openEditDialog(row)"
            >编辑</el-button>
            <el-button
              v-if="hasRoute('DELETE', `/api/serverDeploy/credentials/${row.id}`)"
              size="small"
              type="danger"
              link
              @click="confirmDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增 / 编辑对话框 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.mode === 'add' ? '新建云平台凭证' : '编辑云平台凭证'"
      width="560px"
      @closed="onDialogClosed"
    >
      <el-form
        ref="formRef"
        :model="dialog.form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="备注名" prop="name">
          <el-input v-model="dialog.form.name" placeholder="如:xxx公司OA1" clearable />
        </el-form-item>
        <el-form-item label="厂商" prop="type">
          <el-radio-group v-model="dialog.form.type">
            <el-radio-button value="aliyun">阿里云</el-radio-button>
            <el-radio-button value="tencent">腾讯云</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="AccessKey" prop="access_key">
          <el-input
            v-model="dialog.form.access_key"
            placeholder="AccessKey ID(SK ID)"
            clearable
            show-password
          />
        </el-form-item>
        <el-form-item label="SecretKey" prop="secret_key">
          <el-input
            v-model="dialog.form.secret_key"
            placeholder="AccessKey Secret"
            clearable
            show-password
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="dialog.form.remark"
            type="textarea"
            :rows="2"
            placeholder="可选,如用途说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.loading" @click="submitForm">
          {{ dialog.mode === 'add' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  listCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential
} from '@/api/serverDeploy'

const userStore = useUserStore()
const hasRoute = userStore.hasRoute

const list = ref([])
const loading = ref(false)

const filter = reactive({
  type: '',     // 空 = 全部 / aliyun / tencent
  keyword: ''
})

async function loadList() {
  loading.value = true
  try {
    const r = await listCredentials({
      type: filter.type,
      keyword: filter.keyword
    })
    list.value = (r.data && r.data.list) || []
  } catch (e) {
    list.value = []
    ElMessage.error('加载凭证失败: ' + ((e && (e.msg || e.message)) || '网络异常'))
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  loadList()
}

// 新增 / 编辑对话框
const dialog = reactive({
  visible: false,
  loading: false,
  mode: 'add', // 'add' | 'edit'
  editingId: null,
  form: { name: '', type: 'aliyun', access_key: '', secret_key: '', remark: '' }
})
const formRef = ref(null)

const formRules = {
  name: [{ required: true, message: '请输入备注名', trigger: 'blur' }],
  type: [{ required: true, message: '请选择厂商', trigger: 'change' }],
  access_key: [{ required: true, message: '请输入 AccessKey', trigger: 'blur' }],
  secret_key: [{ required: true, message: '请输入 SecretKey', trigger: 'blur' }]
}

function resetForm() {
  dialog.editingId = null
  dialog.mode = 'add'
  dialog.form = { name: '', type: 'aliyun', access_key: '', secret_key: '', remark: '' }
}

function openAddDialog() {
  resetForm()
  dialog.visible = true
}

async function openEditDialog(row) {
  // 先开对话框,再异步加载详情拿明文 secret_key
  resetForm()
  dialog.mode = 'edit'
  dialog.editingId = row.id
  dialog.form.name = row.name
  dialog.form.type = row.type
  dialog.form.access_key = row.access_key
  // mask 字段先按明文位置用回 **** 占位,后面拉详情替换
  dialog.form.secret_key = ''
  dialog.form.remark = row.remark || ''
  dialog.visible = true
  try {
    const r = await getCredential(row.id)
    const c = (r.data && r.data) || {}
    dialog.form.name = c.name || dialog.form.name
    dialog.form.type = c.type || dialog.form.type
    dialog.form.access_key = c.access_key || dialog.form.access_key
    dialog.form.secret_key = c.secret_key || ''
    dialog.form.remark = c.remark || dialog.form.remark
  } catch (e) {
    // 详情失败仍然让用户编辑,但 secret_key 是空(用户需要重新填)
    ElMessage.warning('无法读取完整 SecretKey,请重新填写: ' + ((e && (e.msg || e.message)) || ''))
  }
}

async function submitForm() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  dialog.loading = true
  try {
    if (dialog.mode === 'add') {
      await createCredential(dialog.form)
      ElMessage.success('创建成功')
    } else {
      await updateCredential(dialog.editingId, dialog.form)
      ElMessage.success('保存成功')
    }
    dialog.visible = false
    loadList()
  } catch {
    // 业务码已由 request.js 拦截器弹过 ElMessage,这里仅保留不重复弹
  } finally {
    dialog.loading = false
  }
}

function onDialogClosed() {
  // dialog 关闭后清空表单
  resetForm()
  formRef.value && formRef.value.clearValidate()
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除凭证 "${row.name}"?该操作不可恢复。`, '删除凭证', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await deleteCredential(row.id)
    ElMessage.success('已删除')
    loadList()
  } catch {
    // 错误信息已由拦截器弹过
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.cloud-credential-page { padding: 16px; }
.header-row { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; gap: 8px; align-items: center; }
.header-right { display: flex; gap: 8px; align-items: center; }
.ak-cell { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 12px; }
.sk-cell { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 12px; color: #909399; }
</style>
