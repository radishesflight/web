<!--
  登录页

  流程:
   1. 用户填用户名密码,点登录
   2. 调 login API(POST /api/login)
   3. 成功 → userStore.setLoginData + 跳首页
   4. 失败 → axios 拦截器已经弹 toast,这里 catch 静默
-->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { login } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loginForm = ref({
  username: '',
  password: '',
  remember: false
})
const loading = ref(false)

const handleLogin = async () => {
  // 前端校验(避免无意义请求)
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    const res = await login({
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    // res.data = { token, user, menus, permissions }
    const { token, user, menus, permissions } = res.data
    // 一次性设置(写 store + 写 localStorage)
    userStore.setLoginData({ token, user, menus, permissions })
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error) {
    // 业务错误已经由 axios 拦截器弹了 toast,这里只 log
    console.error('登录失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>后台管理系统</h2>
        </div>
      </template>

      <el-form :model="loginForm" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="loginForm.remember">记住密码</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width: 100%;" :loading="loading" @click="handleLogin">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0;
  color: #303133;
}
</style>
