export type Role = 'admin' | 'operator'

export interface UserInfo {
  username: string
  name: string
  role: Role
  roleName: string
}

export type DeviceType = 'transformer' | 'switchgear' | 'busbar' | 'tower'

export type DeviceStatus = 'normal' | 'warning' | 'fault' | 'offline'

export interface Device {
  id: string
  name: string
  type: DeviceType
  status: DeviceStatus
  voltage: number
  current: number
  load: number
  position: [number, number, number]
  lng: number
  lat: number
}

export type VoltageLevel = '220kV' | '110kV' | '10kV' | '0.4kV'

export type GridNodeKind = 'substation' | 'tower' | 'distribution'

/** 电网拓扑节点：变电站 / 输电杆塔 / 配电台区 */
export interface GridNode {
  id: string
  name: string
  kind: GridNodeKind
  voltage: VoltageLevel
  status: DeviceStatus
  lng: number
  lat: number
  /** 变电站：所属行政区；杆塔：所属线路；台区：所属变电站 */
  owner?: string
  /** 变电站：站内设备数（台）；台区：供电户数（户） */
  count?: number
  /** 变电站：主变容量（MVA）；台区：配变容量（kVA） */
  capacity?: number
}

export type GridLineKind = 'transmission' | 'distribution'

/** 电网线路：站间输电线路 / 站到台区的 10kV 配电线路 */
export interface GridLine {
  id: string
  name: string
  kind: GridLineKind
  voltage: VoltageLevel
  status: DeviceStatus
  path: Array<[number, number]>
}

export type AlarmLevel = 'warning' | 'fault'

export interface Alarm {
  id: string
  deviceId: string
  deviceName: string
  level: AlarmLevel
  message: string
  time: string
}
