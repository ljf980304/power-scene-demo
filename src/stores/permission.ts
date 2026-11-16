import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import type { Role } from '@/types'
import { asyncRoutes } from '@/router/routes'

function filterRoutes(routes: RouteRecordRaw[], role: Role): RouteRecordRaw[] {
  return routes
    .filter((route) => {
      const roles = route.meta?.roles as Role[] | undefined
      return !roles || roles.includes(role)
    })
    .map((route) => {
      if (!route.children) return route
      return { ...route, children: filterRoutes(route.children, role) }
    })
}

export const usePermissionStore = defineStore('permission', () => {
  const menus = ref<RouteRecordRaw[]>([])
  const ready = ref(false)

  function build(role: Role) {
    menus.value = filterRoutes(asyncRoutes, role)
    ready.value = true
    return menus.value
  }

  function reset() {
    menus.value = []
    ready.value = false
  }

  return { menus, ready, build, reset }
})
