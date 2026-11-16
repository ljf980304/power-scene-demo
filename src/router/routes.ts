import type { RouteRecordRaw } from 'vue-router'

export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: '无访问权限' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
]

export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'layout',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/dashboard',
    meta: { roles: ['admin', 'operator'] },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '监控总览', roles: ['admin', 'operator'] },
      },
      {
        path: 'scene',
        name: 'scene',
        component: () => import('@/views/SceneView.vue'),
        meta: { title: '三维场景', roles: ['admin', 'operator'] },
      },
      {
        path: 'map',
        name: 'map',
        component: () => import('@/views/MapView.vue'),
        meta: { title: '三维地图', roles: ['admin', 'operator'] },
      },
      {
        path: 'alarms',
        name: 'alarms',
        component: () => import('@/views/AlarmCenterView.vue'),
        meta: { title: '告警中心', roles: ['admin'] },
      },
    ],
  },
]
