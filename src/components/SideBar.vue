<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

defineProps({
  collapse: {
    type: Boolean,
    default: false
  }
})

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const activeMenu = computed(() => route.path)

const hasChildren = (item) => {
  return item.children && item.children.length > 0
}

const handleSelect = (index) => {
  router.push(index)
}

const menuList = computed(() => {
  const backendMenus = userStore.menus || []
  return backendMenus
})

const resolveIcon = (iconName) => {
  if (!iconName) return 'Menu'
  return iconName
}
</script>

<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="collapse"
    :collapse-transition="false"
    class="sidebar-menu"
    background-color="#304156"
    text-color="#bfcbd9"
    active-text-color="#409EFF"
  >
    <div class="logo-container" v-if="!collapse">
      <h3>后台管理系统</h3>
    </div>
    <div class="logo-container collapse-logo" v-else>
      <h3>管</h3>
    </div>

    <template v-for="item in menuList" :key="item.id || item.path">
      <el-sub-menu v-if="hasChildren(item)" :index="item.path || item.id">
        <template #title>
          <el-icon class="menu-icon" v-if="item.icon">
            <component :is="resolveIcon(item.icon)" />
          </el-icon>
          <span>{{ item.name }}</span>
        </template>
        <el-menu-item
          v-for="child in item.children"
          :key="child.id || child.path"
          :index="child.path || child.id"
          @click="handleSelect(child.path)"
        >
          <el-icon class="menu-icon" v-if="child.icon">
            <component :is="resolveIcon(child.icon)" />
          </el-icon>
          <span>{{ child.name }}</span>
        </el-menu-item>
      </el-sub-menu>

      <el-menu-item v-else :index="item.path || item.id" @click="handleSelect(item.path)">
        <el-icon class="menu-icon" v-if="item.icon">
          <component :is="resolveIcon(item.icon)" />
        </el-icon>
        <template #title>
          <span>{{ item.name }}</span>
        </template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<style scoped>
.sidebar-menu {
  height: 100%;
  width: 100%;
  border-right: none;
  overflow-y: auto;
}

.logo-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2b3a4a;
}

.logo-container h3 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.collapse-logo h3 {
  font-size: 16px;
}

.menu-icon {
  width: 1em;
  height: 1em;
  margin-right: 8px;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  display: flex;
  align-items: center;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: #263445 !important;
}
</style>
