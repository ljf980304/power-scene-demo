import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { asyncRoutes, constantRoutes } from './routes'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import type { Role } from '@/types'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 }),
})

function joinPath(parent: string, path: string): string {
  if (path.startsWith('/')) return path
  return `${parent === '/' ? '' : parent}/${path}`.replace(/\/+/g, '/') || '/'
}

/** 在完整路由表中查找目标路径所要求的角色,未找到返回 null */
function findRouteRoles(routes: RouteRecordRaw[], target: string, parent = ''): Role[] | null {
  for (const route of routes) {
    const fullPath = joinPath(parent, route.path)
    const roles = route.meta?.roles as Role[] | undefined
    if (fullPath === target) return roles ?? null
    if (route.children) {
      const nested = findRouteRoles(route.children, target, fullPath)
      if (nested) return nested
    }
  }
  return null
}

router.beforeEach((to) => {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  if (to.path === '/login') {
    return userStore.isLogin ? { path: '/' } : true
  }

  if (!userStore.isLogin) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!permissionStore.ready && userStore.user) {
    const routes = permissionStore.build(userStore.user.role)
    routes.forEach((route) => router.addRoute(route))
    // 重新进入目标地址时保留查询参数,例如从地图跳转场景时携带的 scenario/device
    return { path: to.path, query: to.query, hash: to.hash, replace: true }
  }

  // 角色无权限的路由不会被注册,会命中 404 兜底;
  // 这里识别出「路径存在但角色不足」的情况,统一跳 403。
  if (userStore.user) {
    const roles = findRouteRoles(asyncRoutes, to.path)
    if (roles && !roles.includes(userStore.user.role)) {
      return { path: '/403', replace: true }
    }
  }

  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · 电网三维可视化平台` : '电网三维可视化平台'
})

export default router
