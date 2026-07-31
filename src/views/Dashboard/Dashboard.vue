<script setup>
import { ref } from 'vue'

const statsData = ref([
  { title: '用户总数', value: 1024, icon: 'User', color: '#409EFF' },
  { title: '订单总数', value: 3567, icon: 'Tickets', color: '#67C23A' },
  { title: '商品总数', value: 892, icon: 'Goods', color: '#E6A23C' },
  { title: '销售额', value: 128960, icon: 'Money', color: '#F56C6C' }
])
</script>

<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="(item, index) in statsData" :key="index">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" :style="{ backgroundColor: item.color }">
              <el-icon :size="32">
                <component :is="item.icon" />
              </el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-title">{{ item.title }}</p>
              <p class="stat-value">{{ item.value }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 20px;
}

.stat-card {
  margin-bottom: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-title {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.stat-value {
  margin: 8px 0 0;
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}
</style>
