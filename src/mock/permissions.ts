import type { Role } from '@/types'

export const rolePermissions: Record<Role, string[]> = {
  admin: ['device:export', 'alarm:ack', 'device:edit', 'scene:control'],
  operator: ['scene:control'],
}
