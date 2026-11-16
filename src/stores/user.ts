import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Role, UserInfo } from '@/types'
import { ROLE_NAMES, findUser, saveRegisteredUser } from '@/mock/users'
import { rolePermissions } from '@/mock/permissions'

const TOKEN_KEY = 'power_scene_token'
const USER_KEY = 'power_scene_user'

export interface RegisterPayload {
  username: string
  name: string
  password: string
  role: Role
}

function readUser(): UserInfo | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as UserInfo | null
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref<UserInfo | null>(readUser())

  const isLogin = computed(() => Boolean(token.value && user.value))
  const permissions = computed(() => (user.value ? rolePermissions[user.value.role] : []))

  function persist(info: UserInfo) {
    user.value = info
    localStorage.setItem(USER_KEY, JSON.stringify(info))
  }

  function signIn(username: string, name: string, role: Role) {
    token.value = `mock-token-${username}-${Date.now()}`
    localStorage.setItem(TOKEN_KEY, token.value)
    persist({ username, name, role, roleName: ROLE_NAMES[role] })
  }

  async function login(username: string, password: string) {
    await new Promise<void>((resolve) => setTimeout(resolve, 420))
    const found = findUser(username)
    if (!found || found.password !== password) {
      throw new Error('用户名或密码错误')
    }
    signIn(found.username, found.name, found.role)
  }

  /**
   * 模拟注册：只写 localStorage，不发任何请求。
   * 注册成功直接登录，省掉访客再去登录页输一遍。
   */
  async function register(payload: RegisterPayload) {
    await new Promise<void>((resolve) => setTimeout(resolve, 420))
    if (findUser(payload.username)) {
      throw new Error('该用户名已被占用')
    }
    saveRegisteredUser({
      username: payload.username,
      name: payload.name,
      password: payload.password,
      role: payload.role,
      roleName: ROLE_NAMES[payload.role],
    })
    signIn(payload.username, payload.name, payload.role)
  }

  /**
   * 只换角色，保留当前用户名和昵称。
   * 以前是从内置账号里找同角色的人替换身份，访客用自己注册的账号登录后
   * 一点「切换角色」身份就变回内置账号，切不回来了。
   */
  function switchRole(role: Role) {
    if (!user.value || user.value.role === role) return
    persist({ ...user.value, role, roleName: ROLE_NAMES[role] })
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isLogin, permissions, login, register, switchRole, logout }
})
