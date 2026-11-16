import type { GridLine, GridNode } from '@/types'

/**
 * 区域电网拓扑：地图只表达「站—线—塔—台区」的层级关系，
 * 站内的主变、母线、开关柜收回三维场景里看。
 *
 *   天河 220kV 站 ──110kV 线路──> 越秀 / 海珠 110kV 站 ──10kV 馈线──> 配电台区 ──220V──> 用户
 */

export const substations: GridNode[] = [
  {
    id: 'SS-TH',
    name: '天河 220kV 变电站',
    kind: 'substation',
    voltage: '220kV',
    status: 'normal',
    lng: 113.3612,
    lat: 23.1247,
    owner: '天河区',
    count: 12,
    capacity: 360,
  },
  {
    id: 'SS-YX',
    name: '越秀 110kV 变电站',
    kind: 'substation',
    voltage: '110kV',
    status: 'warning',
    lng: 113.27,
    lat: 23.135,
    owner: '越秀区',
    count: 12,
    capacity: 126,
  },
  {
    id: 'SS-HZ',
    name: '海珠 110kV 变电站',
    kind: 'substation',
    voltage: '110kV',
    status: 'normal',
    lng: 113.32,
    lat: 23.085,
    owner: '海珠区',
    count: 12,
    capacity: 100,
  },
]

/** 站与站之间的 110kV 联络线 */
export const transmissionLines: GridLine[] = [
  {
    id: 'LN-TH-YX',
    name: '天河—越秀 110kV 线路',
    kind: 'transmission',
    voltage: '110kV',
    status: 'normal',
    path: [
      [113.3612, 23.1247],
      [113.33, 23.14],
      [113.3, 23.138],
      [113.27, 23.135],
    ],
  },
  {
    id: 'LN-TH-HZ',
    name: '天河—海珠 110kV 线路',
    kind: 'transmission',
    voltage: '110kV',
    status: 'normal',
    path: [
      [113.3612, 23.1247],
      [113.345, 23.105],
      [113.33, 23.095],
      [113.32, 23.085],
    ],
  },
]

/** 沿输电线路布置的铁塔 */
export const towers: GridNode[] = [
  { id: 'TW-L1-01', name: '天越线 1 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.3442, lat: 23.1331, owner: '天河—越秀 110kV 线路' },
  { id: 'TW-L1-02', name: '天越线 2 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.3268, lat: 23.1398, owner: '天河—越秀 110kV 线路' },
  { id: 'TW-L1-03', name: '天越线 3 号塔', kind: 'tower', voltage: '110kV', status: 'warning', lng: 113.3078, lat: 23.1385, owner: '天河—越秀 110kV 线路' },
  { id: 'TW-L1-04', name: '天越线 4 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.2889, lat: 23.1369, owner: '天河—越秀 110kV 线路' },
  { id: 'TW-L2-01', name: '天海线 1 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.3539, lat: 23.1158, owner: '天河—海珠 110kV 线路' },
  { id: 'TW-L2-02', name: '天海线 2 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.3466, lat: 23.107, owner: '天河—海珠 110kV 线路' },
  { id: 'TW-L2-03', name: '天海线 3 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.3374, lat: 23.0999, owner: '天河—海珠 110kV 线路' },
  { id: 'TW-L2-04', name: '天海线 4 号塔', kind: 'tower', voltage: '110kV', status: 'normal', lng: 113.3282, lat: 23.0932, owner: '天河—海珠 110kV 线路' },
]

/** 配电台区：10kV 馈线末端，配变降压到 0.4kV/220V 后入户 */
export const distributions: GridNode[] = [
  { id: 'TH-TQ-01', name: '岗顶台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.376, lat: 23.136, owner: '天河 220kV 变电站', count: 258, capacity: 800 },
  { id: 'TH-TQ-02', name: '珠江新城台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.348, lat: 23.113, owner: '天河 220kV 变电站', count: 312, capacity: 1000 },
  { id: 'YX-TQ-01', name: '东山台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.285, lat: 23.128, owner: '越秀 110kV 变电站', count: 186, capacity: 630 },
  { id: 'YX-TQ-02', name: '北京路台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.2655, lat: 23.1235, owner: '越秀 110kV 变电站', count: 240, capacity: 800 },
  { id: 'YX-TQ-03', name: '农讲所台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.276, lat: 23.142, owner: '越秀 110kV 变电站', count: 120, capacity: 400 },
  { id: 'HZ-TQ-01', name: '江南西台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.33, lat: 23.078, owner: '海珠 110kV 变电站', count: 178, capacity: 630 },
  { id: 'HZ-TQ-02', name: '赤岗台区', kind: 'distribution', voltage: '10kV', status: 'warning', lng: 113.306, lat: 23.0905, owner: '海珠 110kV 变电站', count: 142, capacity: 500 },
  { id: 'HZ-TQ-03', name: '琶洲台区', kind: 'distribution', voltage: '10kV', status: 'normal', lng: 113.338, lat: 23.096, owner: '海珠 110kV 变电站', count: 236, capacity: 800 },
]

/** 站到台区的 10kV 配电线路 */
export const distributionLines: GridLine[] = [
  { id: 'FD-TH-01', name: '岗顶 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.3612, 23.1247], [113.37, 23.131], [113.376, 23.136]] },
  { id: 'FD-TH-02', name: '珠江新城 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.3612, 23.1247], [113.354, 23.117], [113.348, 23.113]] },
  { id: 'FD-YX-01', name: '东山 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.27, 23.135], [113.28, 23.131], [113.285, 23.128]] },
  { id: 'FD-YX-02', name: '北京路 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.27, 23.135], [113.2668, 23.129], [113.2655, 23.1235]] },
  { id: 'FD-YX-03', name: '农讲所 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.27, 23.135], [113.274, 23.139], [113.276, 23.142]] },
  { id: 'FD-HZ-01', name: '江南西 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.32, 23.085], [113.326, 23.081], [113.33, 23.078]] },
  { id: 'FD-HZ-02', name: '赤岗 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'warning', path: [[113.32, 23.085], [113.312, 23.088], [113.306, 23.0905]] },
  { id: 'FD-HZ-03', name: '琶洲 10kV 馈线', kind: 'distribution', voltage: '10kV', status: 'normal', path: [[113.32, 23.085], [113.33, 23.091], [113.338, 23.096]] },
]
