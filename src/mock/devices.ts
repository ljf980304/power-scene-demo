import type { Alarm, Device, DeviceStatus } from '@/types'

const BASE_LNG = 113.3612
const BASE_LAT = 23.1247

/** 组内设备的东西向间距 */
const STEP = 0.004
/** 设备组之间的南北向间距，保证任意两个点位不会重合 */
const ROW = 0.0035

/**
 * 按「组 + 组内序号」排布地图点位。
 * 之前用 (index - seed) 算偏移，主变组和开关柜组算出了相同的值，
 * 导致 1号主变 / 电容柜、2号主变 / 站用变柜 的坐标完全重合，
 * 点击时只能拾取到压在上层的那一个。改成每组固定一行，行内居中排开。
 */
function layout(row: number, index: number, count: number): { lng: number; lat: number } {
  return {
    lng: BASE_LNG + (index - (count - 1) / 2) * STEP,
    lat: BASE_LAT + row * ROW,
  }
}

export const devices: Device[] = [
  {
    id: 'TR-001',
    name: '1号主变',
    type: 'transformer',
    status: 'normal',
    voltage: 110.2,
    current: 318,
    load: 62,
    position: [-8, 0, -4],
    ...layout(0, 0, 3),
  },
  {
    id: 'TR-002',
    name: '2号主变',
    type: 'transformer',
    status: 'warning',
    voltage: 109.6,
    current: 402,
    load: 78,
    position: [0, 0, -4],
    ...layout(0, 1, 3),
  },
  {
    id: 'TR-003',
    name: '3号主变',
    type: 'transformer',
    status: 'normal',
    voltage: 110.5,
    current: 286,
    load: 55,
    position: [8, 0, -4],
    ...layout(0, 2, 3),
  },
  {
    id: 'SW-101',
    name: '110kV 进线柜',
    type: 'switchgear',
    status: 'normal',
    voltage: 110.1,
    current: 210,
    load: 41,
    position: [-9, 0, 4],
    ...layout(1, 0, 5),
  },
  {
    id: 'SW-102',
    name: '110kV 母联柜',
    type: 'switchgear',
    status: 'fault',
    voltage: 0,
    current: 0,
    load: 0,
    position: [-5, 0, 4],
    ...layout(1, 1, 5),
  },
  {
    id: 'SW-103',
    name: '10kV 馈线柜',
    type: 'switchgear',
    status: 'normal',
    voltage: 10.4,
    current: 96,
    load: 33,
    position: [-1, 0, 4],
    ...layout(1, 2, 5),
  },
  {
    id: 'SW-104',
    name: '10kV 电容柜',
    type: 'switchgear',
    status: 'normal',
    voltage: 10.2,
    current: 72,
    load: 26,
    position: [3, 0, 4],
    ...layout(1, 3, 5),
  },
  {
    id: 'SW-105',
    name: '10kV 站用变柜',
    type: 'switchgear',
    status: 'offline',
    voltage: 0,
    current: 0,
    load: 0,
    position: [7, 0, 4],
    ...layout(1, 4, 5),
  },
  {
    id: 'BS-201',
    name: '110kV 母线 I 段',
    type: 'busbar',
    status: 'normal',
    voltage: 110.3,
    current: 512,
    load: 58,
    position: [0, 4.6, -9],
    ...layout(2, 0, 2),
  },
  {
    id: 'BS-202',
    name: '110kV 母线 II 段',
    type: 'busbar',
    status: 'warning',
    voltage: 109.8,
    current: 538,
    load: 72,
    position: [0, 4.6, 1],
    ...layout(2, 1, 2),
  },
  {
    id: 'TW-301',
    name: '1号出线杆塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.0,
    current: 180,
    load: 35,
    position: [-18, 0, -14],
    ...layout(-1, 0, 2),
  },
  {
    id: 'TW-302',
    name: '2号出线杆塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.1,
    current: 174,
    load: 34,
    position: [18, 0, -14],
    ...layout(-1, 1, 2),
  },
]

/**
 * 各站的站内设备差异。
 * 220kV 站按 3 台主变配置，110kV 站只带 2 台；状态也各不相同，
 * 这样从地图点进不同变电站，看到的不是同一个院子。
 */
const stationOverrides: Record<
  string,
  { remove?: string[]; status?: Record<string, DeviceStatus> }
> = {
  'SS-TH': {},
  'SS-YX': {
    remove: ['TR-003'],
    status: { 'SW-102': 'normal', 'TR-002': 'warning', 'BS-202': 'warning' },
  },
  'SS-HZ': {
    remove: ['TR-003'],
    status: { 'SW-102': 'warning', 'TR-002': 'normal', 'BS-202': 'normal', 'SW-105': 'normal' },
  },
}

/** 取某座变电站的站内设备；未知站点回落到天河站配置 */
export function getStationDevices(stationId: string): Device[] {
  const override = stationOverrides[stationId] ?? {}
  return devices
    .filter((device) => !override.remove?.includes(device.id))
    .map((device) => ({
      ...device,
      status: override.status?.[device.id] ?? device.status,
    }))
}

/** 输电线路场景的杆塔设备,按 z 轴依次排列成一回 110kV 线路 */
export const transmissionDevices: Device[] = [
  {
    id: 'LT-001',
    name: '1号直线塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.2,
    current: 176,
    load: 34,
    position: [0, 0, -150],
    lng: 113.3702,
    lat: 23.1361,
  },
  {
    id: 'LT-002',
    name: '2号直线塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.1,
    current: 168,
    load: 32,
    position: [2, 0, -90],
    lng: 113.3688,
    lat: 23.1328,
  },
  {
    id: 'LT-003',
    name: '3号耐张塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.3,
    current: 172,
    load: 33,
    position: [-1, 0, -30],
    lng: 113.3674,
    lat: 23.1295,
  },
  {
    id: 'LT-004',
    name: '4号直线塔',
    type: 'tower',
    status: 'warning',
    voltage: 109.7,
    current: 208,
    load: 46,
    position: [1.5, 0, 30],
    lng: 113.366,
    lat: 23.1262,
  },
  {
    id: 'LT-005',
    name: '5号直线塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.0,
    current: 164,
    load: 31,
    position: [-2, 0, 90],
    lng: 113.3646,
    lat: 23.1229,
  },
  {
    id: 'LT-006',
    name: '6号终端塔',
    type: 'tower',
    status: 'normal',
    voltage: 110.1,
    current: 158,
    load: 30,
    position: [0, 0, 150],
    lng: 113.3632,
    lat: 23.1196,
  },
]

export const initialAlarms: Alarm[] = [
  {
    id: 'AL-001',
    deviceId: 'SW-102',
    deviceName: '110kV 母联柜',
    level: 'fault',
    message: '断路器分闸异常',
    time: '10:24:18',
  },
  {
    id: 'AL-002',
    deviceId: 'TR-002',
    deviceName: '2号主变',
    level: 'warning',
    message: '负载率超过 75%',
    time: '10:31:42',
  },
  {
    id: 'AL-003',
    deviceId: 'BS-202',
    deviceName: '110kV 母线 II 段',
    level: 'warning',
    message: '电压波动越限',
    time: '10:35:07',
  },
]

export const alarmPool: Omit<Alarm, 'id' | 'time'>[] = [
  {
    deviceId: 'SW-103',
    deviceName: '10kV 馈线柜',
    level: 'warning',
    message: '电流接近额定值',
  },
  {
    deviceId: 'TR-001',
    deviceName: '1号主变',
    level: 'warning',
    message: '油温上升偏快',
  },
  {
    deviceId: 'TW-302',
    deviceName: '2号出线杆塔',
    level: 'warning',
    message: '线路弧垂异常',
  },
]
