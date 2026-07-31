<script setup>
import { ref } from 'vue'
import SideBar from '@/components/SideBar.vue'
import NavBar from '@/components/NavBar.vue'

const isCollapse = ref(false)

const handleCollapse = (collapse) => {
  isCollapse.value = collapse
}
</script>

<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar-container">
      <SideBar :collapse="isCollapse" />
    </el-aside>
    <el-container>
      <el-header class="header-container">
        <NavBar @toggle-collapse="handleCollapse" :collapse="isCollapse" />
      </el-header>
      <el-main class="main-container">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.sidebar-container {
  height: 100vh;
  transition: width 0.3s;
  overflow-x: hidden;
  overflow-y: hidden;
}

.header-container {
  height: 60px;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.main-container {
  height: calc(100vh - 60px);
  background-color: #f0f2f5;
  padding: 16px;
  overflow-y: auto;
  box-sizing: border-box;
}
</style>
