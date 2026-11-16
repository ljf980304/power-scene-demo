<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <div class="code">403</div>
    <p>当前角色没有该页面的访问权限</p>
    <el-button type="primary" plain @click="router.replace('/')">返回首页</el-button>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  height: 100%;
  color: var(--text-sub);
}

.code {
  font-size: 74px;
  font-weight: 700;
  color: var(--brand);
  opacity: 0.75;
}
</style>
