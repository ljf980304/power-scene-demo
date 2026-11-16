<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import type { Role } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const menus = computed(() => permissionStore.menus[0]?.children ?? [])
const activeMenu = computed(() => route.path)

function rebuildRoutes(role: Role) {
  permissionStore.reset()
  if (router.hasRoute('layout')) {
    router.removeRoute('layout')
  }
  const routes = permissionStore.build(role)
  routes.forEach((item) => router.addRoute(item))
  return routes
}

function handleRoleChange(role: Role) {
  if (role === userStore.user?.role) return
  userStore.switchRole(role)
  const routes = rebuildRoutes(role)
  const first = routes[0]?.children?.[0]
  router.replace(first ? `/${first.path}` : '/403')
}

function handleLogout() {
  userStore.logout()
  permissionStore.reset()
  if (router.hasRoute('layout')) {
    router.removeRoute('layout')
  }
  router.replace('/login')
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">P</span>
        <div>
          <div class="brand-name">PowerScene</div>
          <div class="brand-sub">区域电网三维可视化</div>
        </div>
      </div>

      <el-menu
        :default-active="activeMenu"
        router
        class="menu"
        background-color="transparent"
        text-color="#8ba7c4"
        active-text-color="#36e2d0"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="'/' + item.path">
          {{ item.meta?.title }}
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">v0.1.0 · 演示环境</div>
    </aside>

    <section class="main">
      <header class="topbar">
        <div class="topbar-title">{{ route.meta.title }}</div>
        <div class="topbar-right">
          <el-tag size="small" effect="dark" type="info">{{ userStore.user?.roleName }}</el-tag>
          <el-dropdown @command="handleRoleChange">
            <span class="switch-role">切换角色</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="admin">系统管理员</el-dropdown-item>
                <el-dropdown-item command="operator">运维值班员</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span class="user-name">{{ userStore.user?.name }}</span>
          <el-button link type="danger" @click="handleLogout">退出</el-button>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </section>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100%;
  background: var(--bg-page);
}

.sidebar {
  display: flex;
  flex-direction: column;
  width: 216px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-panel);
  background: linear-gradient(180deg, #0d1b2a 0%, #0a1420 100%);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 18px 18px;
  border-bottom: 1px solid var(--border-panel);
}

.logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--brand), var(--brand-cyan));
  font-weight: 700;
  font-size: 17px;
  color: #04121e;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.brand-sub {
  font-size: 11px;
  color: var(--text-sub);
  margin-top: 2px;
}

.menu {
  flex: 1;
  border-right: none;
  padding: 10px;
}

.menu :deep(.el-menu-item) {
  height: 42px;
  margin-bottom: 4px;
  border-radius: 8px;
  font-size: 13.5px;
}

.menu :deep(.el-menu-item.is-active) {
  background: rgba(54, 226, 208, 0.1);
}

.sidebar-footer {
  padding: 14px 18px;
  font-size: 11px;
  color: var(--text-sub);
  border-top: 1px solid var(--border-panel);
}

.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  flex-shrink: 0;
  padding: 0 22px;
  border-bottom: 1px solid var(--border-panel);
  background: rgba(13, 27, 42, 0.65);
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  color: var(--text-sub);
}

.switch-role {
  cursor: pointer;
  color: var(--brand-cyan);
  font-size: 13px;
}

.user-name {
  color: var(--text-main);
}

.content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
