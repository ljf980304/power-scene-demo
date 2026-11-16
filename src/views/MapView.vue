<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import maplibregl from 'maplibre-gl'
import {
  distributions,
  distributionLines,
  substations,
  towers,
  transmissionLines,
} from '@/mock/grid'
import type { DeviceStatus, GridNode, VoltageLevel } from '@/types'

const router = useRouter()

const nodes: GridNode[] = [...substations, ...towers, ...distributions]
const nodeById = new Map(nodes.map((item) => [item.id, item]))

const voltageColors: Record<VoltageLevel, string> = {
  '220kV': '#36e2d0',
  '110kV': '#3d8fdd',
  '10kV': '#9b8cff',
  '0.4kV': '#ffb340',
}

const statusColors: Record<DeviceStatus, string> = {
  normal: '#d8f6ff',
  warning: '#ffb340',
  fault: '#ff5b6a',
  offline: '#64748b',
}

const statusLabels: Record<DeviceStatus, string> = {
  normal: '正常',
  warning: '告警',
  fault: '故障',
  offline: '离线',
}

const kindLabels = {
  substation: '变电站',
  tower: '输电铁塔',
  distribution: '配电台区',
} as const

const legend: Array<{ label: string; color: string }> = [
  { label: '220kV 变电站', color: voltageColors['220kV'] },
  { label: '110kV 变电站', color: voltageColors['110kV'] },
  { label: '110kV 铁塔', color: '#8ba7c4' },
  { label: '10kV 配电台区', color: voltageColors['10kV'] },
]

const containerRef = ref<HTMLDivElement>()
const selected = ref<GridNode | null>(null)
const mapError = ref(false)
const baseMode = ref<'satellite' | 'roadnet'>('satellite')
const showTransmission = ref(true)
const showDistribution = ref(true)

let map: maplibregl.Map | null = null
let rafId = 0
const flowMarkers: maplibregl.Marker[] = []

const CENTER: [number, number] = [113.3612, 23.1247]
const bounds = new maplibregl.LngLatBounds()
for (const node of nodes) {
  bounds.extend([node.lng, node.lat])
}

const detailRows = computed<Array<{ label: string; value: string }>>(() => {
  const item = selected.value
  if (!item) return []
  const coord = `${item.lng.toFixed(4)}, ${item.lat.toFixed(4)}`

  if (item.kind === 'substation') {
    return [
      { label: '所属区域', value: item.owner ?? '-' },
      { label: '电压等级', value: item.voltage },
      { label: '主变容量', value: `${item.capacity ?? '-'} MVA` },
      { label: '站内设备', value: `${item.count ?? '-'} 台` },
      { label: '坐标', value: coord },
    ]
  }

  if (item.kind === 'tower') {
    return [
      { label: '所属线路', value: item.owner ?? '-' },
      { label: '电压等级', value: item.voltage },
      { label: '坐标', value: coord },
    ]
  }

  return [
    { label: '所属变电站', value: item.owner ?? '-' },
    { label: '坐标', value: coord },
  ]
})

const sceneActionLabel = computed(() => {
  if (!selected.value) return ''
  if (selected.value.kind === 'substation') return '进入站内三维场景'
  if (selected.value.kind === 'tower') return '查看输电线路场景'
  return '配电台区暂无三维模型'
})

function enterScene(node: GridNode) {
  if (node.kind === 'substation') {
    router.push({ path: '/scene', query: { scenario: 'substation', station: node.id } })
    return
  }
  if (node.kind === 'tower') {
    router.push({ path: '/scene', query: { scenario: 'transmission' } })
    return
  }
  ElMessage.info('配电台区属于 10kV/0.4kV 配电层，暂未建三维模型')
}

function nodeGeoJson(list: GridNode[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.map((item) => ({
      type: 'Feature',
      properties: {
        id: item.id,
        name: item.name,
        voltage: item.voltage,
        status: item.status,
      },
      geometry: {
        type: 'Point',
        coordinates: [item.lng, item.lat],
      },
    })),
  }
}

function lineGeoJson(list: typeof transmissionLines): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.map((item) => ({
      type: 'Feature',
      properties: { id: item.id, name: item.name, status: item.status },
      geometry: {
        type: 'LineString',
        coordinates: item.path,
      },
    })),
  }
}

const voltageExpression = (fallback: string) =>
  [
    'match',
    ['get', 'voltage'],
    '220kV',
    voltageColors['220kV'],
    '110kV',
    voltageColors['110kV'],
    '10kV',
    voltageColors['10kV'],
    fallback,
  ] as unknown as maplibregl.ExpressionSpecification

const statusExpression = () =>
  [
    'match',
    ['get', 'status'],
    'normal',
    statusColors.normal,
    'warning',
    statusColors.warning,
    'fault',
    statusColors.fault,
    'offline',
    statusColors.offline,
    statusColors.normal,
  ] as unknown as maplibregl.ExpressionSpecification

function createLabelImage(name: string) {
  const ratio = 2
  const fontSize = 12 * ratio
  const padding = 7 * ratio
  const height = 22 * ratio
  const font = `500 ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.font = font
  const textWidth = Math.ceil(ctx.measureText(name).width)
  const width = textWidth + padding * 2
  canvas.width = width
  canvas.height = height

  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(8, 20, 32, 0.82)'
  ctx.fillRect(0.5, 0.5, width - 1, height - 1)
  ctx.strokeStyle = 'rgba(54, 226, 208, 0.35)'
  ctx.lineWidth = ratio
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  ctx.fillStyle = '#cfe6f5'
  ctx.fillText(name, padding, height / 2 + 0.5)

  return { image: { width, height, data: ctx.getImageData(0, 0, width, height).data }, pixelRatio: ratio }
}

interface FlowTrack {
  segments: Array<{ from: [number, number]; to: [number, number]; length: number }>
  total: number
}

const flowTracks: FlowTrack[] = transmissionLines.map((line) => {
  const segments = line.path.slice(1).map((point, index) => {
    const from = line.path[index]
    const to = point
    return { from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]) }
  })
  return { segments, total: segments.reduce((sum, item) => sum + item.length, 0) }
})

function pointAlong(track: FlowTrack, progress: number): [number, number] {
  let distance = track.total * progress
  for (const segment of track.segments) {
    if (distance <= segment.length) {
      const ratio = segment.length === 0 ? 0 : distance / segment.length
      return [
        segment.from[0] + (segment.to[0] - segment.from[0]) * ratio,
        segment.from[1] + (segment.to[1] - segment.from[1]) * ratio,
      ]
    }
    distance -= segment.length
  }
  const last = track.segments[track.segments.length - 1]
  return last ? last.to : [0, 0]
}

function createFlowMarker(): maplibregl.Marker {
  const el = document.createElement('div')
  el.className = 'flow-dot'
  return new maplibregl.Marker({ element: el })
}

function animateFlows() {
  const seconds = performance.now() / 1000
  flowMarkers.forEach((marker, index) => {
    const track = flowTracks[index]
    if (!track) return
    const progress = (seconds * 0.12 + index * 0.4) % 1
    marker.setLngLat(pointAlong(track, progress))
    marker.getElement().style.opacity = showTransmission.value ? '1' : '0'
  })
  rafId = requestAnimationFrame(animateFlows)
}

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [1, 2, 3, 4].map(
          (index) => `https://webst0${index}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`,
        ),
        tileSize: 256,
      },
      satelliteAnnotation: {
        type: 'raster',
        tiles: [1, 2, 3, 4].map(
          (index) => `https://webst0${index}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}`,
        ),
        tileSize: 256,
      },
      roadnet: {
        type: 'raster',
        tiles: [1, 2, 3, 4].map(
          (index) =>
            `https://webrd0${index}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`,
        ),
        tileSize: 256,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#081420' },
      },
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        paint: {
          'raster-opacity': 1,
          'raster-saturation': -0.25,
          'raster-brightness-max': 0.82,
          'raster-contrast': 0.12,
        },
      },
      {
        id: 'satellite-annotation',
        type: 'raster',
        source: 'satelliteAnnotation',
        // 底图注记压暗一点，避免小区名和 POI 图标抢掉电网节点的注意力
        paint: { 'raster-opacity': 0.45 },
      },
      {
        id: 'roadnet',
        type: 'raster',
        source: 'roadnet',
        layout: { visibility: 'none' },
        paint: {
          'raster-opacity': 0.9,
          'raster-saturation': -0.6,
          'raster-brightness-max': 0.72,
        },
      },
    ],
  }
}

function fitAllNodes(duration = 0) {
  map?.fitBounds(bounds, {
    padding: { top: 110, right: 110, bottom: 110, left: 110 },
    maxZoom: 13.8,
    duration,
  })
}

function resetView() {
  fitAllNodes(800)
}

function togglePitch() {
  if (!map) return
  const flat = map.getPitch() > 10
  map.easeTo({ pitch: flat ? 0 : 45, bearing: flat ? 0 : -16, duration: 600 })
}

function switchBase(mode: 'satellite' | 'roadnet') {
  if (!map || baseMode.value === mode) return
  baseMode.value = mode
  const satelliteVisible = mode === 'satellite' ? 'visible' : 'none'
  map.setLayoutProperty('satellite', 'visibility', satelliteVisible)
  map.setLayoutProperty('satellite-annotation', 'visibility', satelliteVisible)
  map.setLayoutProperty('roadnet', 'visibility', mode === 'roadnet' ? 'visible' : 'none')
}

function setLayersVisible(ids: string[], visible: boolean) {
  if (!map) return
  for (const id of ids) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }
}

function toggleNetwork(kind: 'transmission' | 'distribution') {
  if (kind === 'transmission') {
    showTransmission.value = !showTransmission.value
    setLayersVisible(
      ['transmission-lines-casing', 'transmission-lines', 'towers', 'tower-labels'],
      showTransmission.value,
    )
    return
  }
  showDistribution.value = !showDistribution.value
  setLayersVisible(
    ['distribution-lines-casing', 'distribution-lines', 'distributions', 'distribution-labels'],
    showDistribution.value,
  )
}

onMounted(() => {
  if (!containerRef.value) return

  map = new maplibregl.Map({
    container: containerRef.value,
    style: buildStyle(),
    center: CENTER,
    zoom: 12.2,
    pitch: 45,
    bearing: -16,
    attributionControl: false,
  })

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')

  map.on('error', (event) => {
    mapError.value = true
    console.warn('[map] 底图资源加载失败:', event.error)
  })

  map.on('load', () => {
    if (!map) return
    mapError.value = false

    map.addSource('transmission-lines', { type: 'geojson', data: lineGeoJson(transmissionLines) })
    map.addSource('distribution-lines', { type: 'geojson', data: lineGeoJson(distributionLines) })
    map.addSource('substations', { type: 'geojson', data: nodeGeoJson(substations) })
    map.addSource('towers', { type: 'geojson', data: nodeGeoJson(towers) })
    map.addSource('distributions', { type: 'geojson', data: nodeGeoJson(distributions) })

    // 卫星底图很花，细线直接铺上去基本看不见，先垫一层深色描边
    map.addLayer({
      id: 'transmission-lines-casing',
      type: 'line',
      source: 'transmission-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#04121e',
        'line-width': 7,
        'line-opacity': 0.6,
      },
    })

    map.addLayer({
      id: 'transmission-lines',
      type: 'line',
      source: 'transmission-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#36e2d0',
        'line-width': 3,
        'line-opacity': 1,
      },
    })

    map.addLayer({
      id: 'distribution-lines-casing',
      type: 'line',
      source: 'distribution-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#04121e',
        'line-width': 5,
        'line-opacity': 0.55,
      },
    })

    map.addLayer({
      id: 'distribution-lines',
      type: 'line',
      source: 'distribution-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#b0a3ff',
        'line-width': 2.2,
        'line-opacity': 1,
        'line-dasharray': [3, 2],
      },
    })

    map.addLayer({
      id: 'substation-glow',
      type: 'circle',
      source: 'substations',
      paint: {
        'circle-radius': 26,
        'circle-color': voltageExpression(voltageColors['110kV']),
        'circle-opacity': 0.16,
        'circle-blur': 1,
      },
    })

    map.addLayer({
      id: 'substations',
      type: 'circle',
      source: 'substations',
      paint: {
        'circle-radius': ['match', ['get', 'voltage'], '220kV', 9, 7] as unknown as number,
        'circle-color': voltageExpression(voltageColors['110kV']),
        'circle-stroke-width': 2,
        'circle-stroke-color': statusExpression(),
      },
    })

    map.addLayer({
      id: 'towers',
      type: 'circle',
      source: 'towers',
      paint: {
        'circle-radius': 4.5,
        'circle-color': '#8ba7c4',
        'circle-stroke-width': 1.4,
        'circle-stroke-color': statusExpression(),
      },
    })

    map.addLayer({
      id: 'distributions',
      type: 'circle',
      source: 'distributions',
      paint: {
        'circle-radius': 5.5,
        'circle-color': voltageColors['10kV'],
        'circle-stroke-width': 1.6,
        'circle-stroke-color': statusExpression(),
      },
    })

    const groups: Array<{ list: GridNode[]; labelLayer: string; source: string }> = [
      { list: substations, labelLayer: 'substation-labels', source: 'substations' },
      { list: towers, labelLayer: 'tower-labels', source: 'towers' },
      { list: distributions, labelLayer: 'distribution-labels', source: 'distributions' },
    ]

    for (const group of groups) {
      for (const node of group.list) {
        const label = createLabelImage(node.name)
        if (label) {
          map.addImage(`label-${node.id}`, label.image, { pixelRatio: label.pixelRatio })
        }
      }

      map.addLayer({
        id: group.labelLayer,
        type: 'symbol',
        source: group.source,
        layout: {
          'icon-image': ['concat', 'label-', ['get', 'id']],
          'icon-anchor': 'top',
          'icon-offset': [0, 12],
          'icon-padding': 4,
        },
      })
    }

    for (const marker of flowMarkers) marker.remove()
    flowMarkers.length = 0
    for (let index = 0; index < flowTracks.length; index += 1) {
      const marker = createFlowMarker().setLngLat(CENTER)
      marker.addTo(map)
      flowMarkers.push(marker)
    }
    animateFlows()
    fitAllNodes(0)

    const clickable = [
      ['substations', 'substation-labels'],
      ['towers', 'tower-labels'],
      ['distributions', 'distribution-labels'],
    ]

    for (const layers of clickable) {
      for (const layerId of layers) {
        map.on('click', layerId, (event) => {
          const feature = event.features?.[0]
          if (!feature) return
          const id = feature.properties?.id as string | undefined
          selected.value = id ? (nodeById.get(id) ?? null) : null
        })

        map.on('mouseenter', layerId, () => {
          if (map) map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', layerId, () => {
          if (map) map.getCanvas().style.cursor = ''
        })
      }
    }
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  flowMarkers.forEach((marker) => marker.remove())
  flowMarkers.length = 0
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-page">
    <div ref="containerRef" class="map-host" />

    <div class="city-badge">
      <span class="city-dot" />
      广州 · 110kV 及以下区域电网
    </div>

    <div class="overlay legend">
      <div class="legend-title">电网层级</div>
      <div v-for="item in legend" :key="item.label" class="legend-item">
        <span class="dot" :style="{ background: item.color }" />
        {{ item.label }}
      </div>
      <div class="legend-item line-item">
        <span class="line line--transmission" />
        110kV 输电线路
      </div>
      <div class="legend-item">
        <span class="line line--distribution" />
        10kV 配电线路
      </div>
      <div class="legend-item">
        <span class="flow-dot-legend" />
        潮流方向
      </div>
    </div>

    <transition name="slide">
      <aside v-if="selected" class="overlay detail">
        <header>
          <div>
            <div class="detail-name">{{ selected.name }}</div>
            <div class="detail-id">{{ kindLabels[selected.kind] }} · {{ selected.id }}</div>
          </div>
          <el-button link @click="selected = null">✕</el-button>
        </header>
        <div class="detail-status">
          <span class="dot" :style="{ background: statusColors[selected.status] }" />
          {{ statusLabels[selected.status] }}
        </div>
        <dl>
          <div v-for="row in detailRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
        <div v-if="selected.kind === 'distribution'" class="flow-chain">
          <div class="chain-item">10kV 进线</div>
          <span class="chain-arrow" />
          <div class="chain-item chain-item--core">{{ selected.capacity }} kVA 配变</div>
          <span class="chain-arrow" />
          <div class="chain-item">0.4kV 母线</div>
          <span class="chain-arrow" />
          <div class="chain-item chain-item--user">220V · {{ selected.count }} 户</div>
        </div>

        <el-button
          class="scene-entry"
          size="small"
          type="primary"
          plain
          :disabled="selected.kind === 'distribution'"
          @click="enterScene(selected)"
        >
          {{ sceneActionLabel }}
        </el-button>
      </aside>
    </transition>

    <div v-if="mapError" class="overlay map-error">
      底图服务加载失败,地图可能无法显示,请检查网络后刷新
    </div>

    <div class="attribution">底图 © 高德地图 · 仅用于演示</div>

    <div class="overlay toolbar">
      <el-button size="small" @click="resetView">重置视角</el-button>
      <el-button size="small" @click="togglePitch">切换俯视/斜视</el-button>
      <el-button
        size="small"
        :type="baseMode === 'satellite' ? 'primary' : 'default'"
        plain
        @click="switchBase('satellite')"
      >
        卫星影像
      </el-button>
      <el-button
        size="small"
        :type="baseMode === 'roadnet' ? 'primary' : 'default'"
        plain
        @click="switchBase('roadnet')"
      >
        标准路网
      </el-button>
      <el-button size="small" :type="showTransmission ? 'primary' : 'default'" plain @click="toggleNetwork('transmission')">
        输电层
      </el-button>
      <el-button size="small" :type="showDistribution ? 'primary' : 'default'" plain @click="toggleNetwork('distribution')">
        配电层
      </el-button>
      <span class="tip">点击站 / 塔 / 台区查看详情</span>
    </div>
  </div>
</template>

<style scoped>
.map-page {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #081420;
}

.map-host {
  position: absolute;
  inset: 0;
}

.overlay {
  position: absolute;
  border: 1px solid var(--border-panel);
  border-radius: 10px;
  background: rgba(10, 22, 34, 0.8);
  backdrop-filter: blur(8px);
}

.city-badge {
  position: absolute;
  top: 18px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border: 1px solid rgba(54, 226, 208, 0.28);
  border-radius: 999px;
  background: rgba(8, 20, 32, 0.72);
  backdrop-filter: blur(8px);
  font-size: 12.5px;
  letter-spacing: 0.5px;
  color: #d6ecf5;
  transform: translateX(-50%);
  pointer-events: none;
}

.city-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand-cyan);
  box-shadow: 0 0 8px 2px rgba(54, 226, 208, 0.65);
}

.attribution {
  position: absolute;
  bottom: 8px;
  left: 12px;
  font-size: 10.5px;
  color: rgba(214, 236, 245, 0.55);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}

.legend {
  top: 16px;
  left: 16px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: var(--text-sub);
}

.legend-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-main);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.line {
  width: 18px;
  height: 0;
  border-top: 2px solid var(--brand-cyan);
}

.line--distribution {
  border-top: 1.5px dashed #9b8cff;
}

.line-item {
  margin-top: 10px;
}

.flow-dot-legend {
  width: 7px;
  height: 7px;
  margin-left: 6px;
  border-radius: 50%;
  background: #36e2d0;
  box-shadow: 0 0 8px 2px rgba(54, 226, 208, 0.7);
}

.detail {
  top: 16px;
  right: 60px;
  width: 250px;
  padding: 16px;
}

.detail header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.detail-name {
  font-size: 15px;
  font-weight: 600;
}

.detail-id {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--text-sub);
}

.detail-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 12px 0 14px;
  font-size: 12.5px;
  color: var(--text-sub);
}

.detail dl {
  margin: 0;
}

.detail dl > div {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px dashed rgba(64, 158, 255, 0.14);
  font-size: 12.5px;
}

.detail dt {
  color: var(--text-sub);
}

.detail dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.scene-entry {
  width: 100%;
  margin-top: 14px;
}

.flow-chain {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px dashed rgba(155, 140, 255, 0.35);
  border-radius: 8px;
  background: rgba(155, 140, 255, 0.06);
}

.chain-item {
  padding: 4px 0;
  font-size: 12px;
  text-align: center;
  color: var(--text-main);
}

.chain-item--core {
  font-weight: 600;
  color: #c9bfff;
}

.chain-item--user {
  color: var(--brand-cyan);
}

.chain-arrow {
  position: relative;
  align-self: center;
  width: 1px;
  height: 12px;
  background: rgba(155, 140, 255, 0.45);
}

.chain-arrow::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -1px;
  width: 5px;
  height: 5px;
  border-right: 1px solid rgba(155, 140, 255, 0.8);
  border-bottom: 1px solid rgba(155, 140, 255, 0.8);
  transform: translateX(-50%) rotate(45deg);
}

.toolbar {
  bottom: 18px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.map-error {
  bottom: 72px;
  left: 50%;
  max-width: min(420px, calc(100% - 32px));
  padding: 8px 14px;
  font-size: 12px;
  color: var(--warning);
  border-color: rgba(255, 179, 64, 0.35);
  transform: translateX(-50%);
}

.tip {
  font-size: 11.5px;
  color: var(--text-sub);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>

<style>
.flow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #36e2d0;
  box-shadow: 0 0 10px 2px rgba(54, 226, 208, 0.7);
  transition: opacity 0.3s;
}
</style>
