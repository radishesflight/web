<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { logout } from '@/api/auth'

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
    ElMessage.info('个人中心')
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
