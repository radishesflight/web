<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { logout } from '@/api/auth'
import { updateMyProfile } from '@/api/system/adminUsers'

const router = useRouter()
const userStore = useUserStore()

const props = defineProps({
  collapse: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-collapse'])

const handleToggle = () => {
  emit('toggle-collapse', !props.collapse)
}

// 个人中心弹窗(2026-10-19 新增)
const profileDialogVisible = ref(false)
const profileFormRef = ref(null)
const profileForm = ref({
  email: '',
  phone: '',
  old_password: '',
  new_password: ''
})
const profileLoading = ref(false)

const profileRules = {
  old_password: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] }
  ],
  new_password: [
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' }
  ]
}

const openProfile = () => {
  // 从 userStore 同步当前值
  const u = userStore.user || {}
  profileForm.value = {
    email: u.email || '',
    phone: u.phone || '',
    old_password: '',
    new_password: ''
  }
  profileDialogVisible.value = true
}

const closeProfile = () => {
  profileDialogVisible.value = false
  profileFormRef.value?.clearValidate()
}

const submitProfile = async () => {
  if (!profileFormRef.value) return
  try {
    await profileFormRef.value.validate()
  } catch {
    return // 校验失败
  }
  profileLoading.value = true
  try {
    // 后端 service.UpdateMe 接受空字符串=不改;但 new_password 留空时不强求改
    await updateMyProfile({
      email: profileForm.value.email,
      phone: profileForm.value.phone,
      old_password: profileForm.value.old_password,
      new_password: profileForm.value.new_password
    })

    // 2026-10-19:改密码后强制重新登录
    //   旧 token 还带着旧 user_id,如果别人截获仍可用
    //   强制重登后让所有会话用新密码,旧 token 失效(后端 cache.ValidateToken 还在 Redis 里,
    //   但因为 user_id 不变,token 本身不会失效 — 因此需要主动 logout 删 Redis 里的 token)
    if (profileForm.value.new_password) {
      try {
        await logout() // 删 Redis 里的 token(后端 DeleteToken)
      } catch {
        // 忽略 logout 错误,继续清理本地
      }
      userStore.logout()
      ElMessageBox.alert('密码已修改,请使用新密码重新登录', '安全提示', {
        type: 'success',
        confirmButtonText: '去登录'
      })
        .then(() => router.push('/login'))
        .catch(() => router.push('/login'))
      return
    }

    ElMessage.success('保存成功')
    // 重新拉 user info,刷新 userStore
    await userStore.refreshUserInfo()
    closeProfile()
  } catch (e) {
    // request.js 拦截器已经弹过 toast,这里不用再弹
    // 保留 catch 防止 unhandled rejection
    console.error('[NavBar] submitProfile failed:', e)
  } finally {
    profileLoading.value = false
  }
}

const handleCommand = async (command) => {
  if (command === 'logout') {
    try {
      await logout()
    } catch {
      // 忽略退出接口错误,仍然清理本地状态
    }
    userStore.logout()
    ElMessage.success('退出登录成功')
    router.push('/login')
  } else if (command === 'profile') {
    openProfile()
  } else if (command === 'settings') {
    ElMessage.info('系统设置')
  }
}
</script>

<template>
  <div class="navbar-container">
    <div class="left">
      <el-icon class="collapse-btn" @click="handleToggle">
        <Fold v-if="!collapse" />
        <Expand v-else />
      </el-icon>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <div class="right">
      <el-dropdown @command="handleCommand">
        <span class="user-dropdown">
          <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
          <span class="username">{{ userStore.user?.username || '未登录' }}</span>
          <span class="role-name" v-if="userStore.user?.role">({{ userStore.user.role }})</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">个人中心</el-dropdown-item>
            <el-dropdown-item command="settings">系统设置</el-dropdown-item>
            <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 个人中心弹窗(2026-10-19 新增) -->
    <el-dialog
      v-model="profileDialogVisible"
      title="个人中心"
      width="500px"
      :close-on-click-modal="false"
      @close="closeProfile"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px;"
      >
        任何修改都需要输入当前密码确认。新密码留空 = 不修改密码,只改邮箱/手机号。
      </el-alert>
      <el-form
        ref="profileFormRef"
        :model="profileForm"
        :rules="profileRules"
        label-width="100px"
        @submit.prevent="submitProfile"
      >
        <el-form-item label="用户名">
          <el-input :model-value="userStore.user?.username || ''" disabled />
        </el-form-item>
        <el-form-item label="角色">
          <el-input :model-value="userStore.user?.role || ''" disabled />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="profileForm.email" placeholder="可改" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="profileForm.phone" placeholder="可改" />
        </el-form-item>
        <el-form-item label="当前密码" prop="old_password">
          <el-input
            v-model="profileForm.old_password"
            type="password"
            show-password
            placeholder="必填,验证身份"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input
            v-model="profileForm.new_password"
            type="password"
            show-password
            placeholder="留空=不修改密码,至少 6 位"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeProfile">取消</el-button>
        <el-button type="primary" :loading="profileLoading" @click="submitProfile">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.navbar-container {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #606266;
}

.collapse-btn:hover {
  color: #409EFF;
}

.right {
  display: flex;
  align-items: center;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  color: #606266;
  font-size: 14px;
}

.role-name {
  color: #909399;
  font-size: 12px;
}
</style>
