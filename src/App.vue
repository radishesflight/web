<!--
  根组件
  - 只是 <RouterView /> 容器
  - 全局 reset 样式(html/body/#app 100% 高度)
  - 业务布局在 layout/MainLayout.vue
-->
<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

#app {
  height: 100%;
}
</style>
