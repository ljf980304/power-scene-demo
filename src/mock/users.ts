import type { Role, UserInfo } from '@/types'

export interface MockUser extends UserInfo {
  password: string
}

export const ROLE_NAMES: Record<Role, string> = {
  admin: '系统管理员',
  operator: '运维值班员',
}

/** 内置演示账号：访客不注册也能直接登录 */
export const mockUsers: MockUser[] = [
  {
    username: 'admin',
    password: '123456',
    name: '李剑峰',
    role: 'admin',
    roleName: ROLE_NAMES.admin,
  },
  {
    username: 'operator',
    password: '123456',
    name: '张运维',
    role: 'operator',
    roleName: ROLE_NAMES.operator,
  },
]

/**
 * 访客注册的账号只存在本机浏览器里 —— 这是个纯静态演示站，没有后端。
 * 换浏览器、清缓存或换设备都会丢，也算不上真实认证。
 */
const REGISTERED_KEY = 'power_scene_registered_users'

function isMockUser(value: unknown): value is MockUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return (
    typeof user.username === 'string' &&
    typeof user.password === 'string' &&
    typeof user.name === 'string' &&
    (user.role === 'admin' || user.role === 'operator')
  )
}

export function loadRegisteredUsers(): MockUser[] {
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(REGISTERED_KEY) || '[]')
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  // roleName 不入库，统一按当前字典重算，避免旧数据里的文案残留
  return raw.filter(isMockUser).map((user) => ({
    username: user.username,
    password: user.password,
    name: user.name,
    role: user.role,
    roleName: ROLE_NAMES[user.role],
  }))
}

export function saveRegisteredUser(user: MockUser): void {
  const list = loadRegisteredUsers()
  list.push(user)
  localStorage.setItem(REGISTERED_KEY, JSON.stringify(list))
}

/** 内置账号 + 本机注册账号，登录和重名校验都用这一份 */
export function findAllUsers(): MockUser[] {
  return [...mockUsers, ...loadRegisteredUsers()]
}

export function findUser(username: string): MockUser | undefined {
  return findAllUsers().find((item) => item.username === username)
}
