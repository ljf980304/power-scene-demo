import type { App, DirectiveBinding } from 'vue'
import { watchEffect } from 'vue'
import { useUserStore } from '@/stores/user'

const stopHandles = new WeakMap<HTMLElement, () => void>()

function normalize(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value]
}

export function setupPermissionDirective(app: App) {
  app.directive('permission', {
    mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
      const userStore = useUserStore()
      const required = normalize(binding.value)
      const originalDisplay = el.style.display

      // 用响应式副作用代替一次性删除 DOM:
      // 角色切换后按钮会实时显示/隐藏,也不会破坏 Vue 的节点管理。
      const stop = watchEffect(() => {
        const owned = userStore.permissions
        const allowed = required.some((item) => owned.includes(item))
        el.style.display = allowed ? originalDisplay : 'none'
      })

      stopHandles.set(el, stop)
    },
    unmounted(el: HTMLElement) {
      stopHandles.get(el)?.()
      stopHandles.delete(el)
    },
  })
}
