<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { SceneManager } from '@/three/SceneManager'
import type { SceneScenario, SceneStats } from '@/three/SceneManager'
import { getStationDevices, transmissionDevices } from '@/mock/devices'
import { substations } from '@/mock/grid'
import type { Device, DeviceStatus } from '@/types'

const containerRef = ref<HTMLDivElement>()
const manager = shallowRef<SceneManager>()
const selected = ref<Device | null>(null)
const stats = ref<SceneStats>({ fps: 0, calls: 0, triangles: 0 })

const route = useRoute()
const scenario = ref<SceneScenario>('substation')
const requestedScenario = route.query.scenario
if (requestedScenario === 'substation' || requestedScenario === 'transmission') {
  scenario.value = requestedScenario
}
/** 从地图跳转时携带的设备编号,场景加载后自动选中 */
const initialDeviceId = typeof route.query.device === 'string' ? route.query.device : ''

/** 从地图点进变电站时携带的站点编号,决定站名和站内设备清单 */
const requestedStation = typeof route.query.station === 'string' ? route.query.station : ''
const station = computed(
  () => substations.find((item) => item.id === requestedStation) ?? substations[0],
)

interface ScenarioOption {
  key: SceneScenario
  label: string
  devices: Device[]
  exportName: string
}

const scenarios = computed<ScenarioOption[]>(() => [
  {
    key: 'substation',
    label: '变电站场景',
    devices: getStationDevices(station.value.id),
    exportName: `${station.value.name}-设备清单.csv`,
  },
  {
    key: 'transmission',
    label: '输电线路场景',
    devices: transmissionDevices,
    exportName: '输电线路设备清单.csv',
  },
])

const currentScenario = computed(
  () => scenarios.value.find((item) => item.key === scenario.value) ?? scenarios.value[0],
)

const legend: Array<{ status: DeviceStatus; label: string; color: string }> = [
  { status: 'normal', label: '正常', color: '#3d8fdd' },
  { status: 'warning', label: '告警', color: '#ffb340' },
  { status: 'fault', label: '故障', color: '#ff5b6a' },
  { status: 'offline', label: '离线', color: '#64748b' },
]

const statusLabels: Record<DeviceStatus, string> = {
  normal: '正常',
  warning: '告警',
  fault: '故障',
  offline: '离线',
}

function createManager() {
  if (!containerRef.value) return
  manager.value?.dispose()
  manager.value = new SceneManager(
    containerRef.value,
    currentScenario.value.devices,
    {
      onSelect: (device) => {
        selected.value = device
      },
      onStats: (value) => {
        stats.value = value
      },
    },
    scenario.value,
  )
}

function switchScenario(next: SceneScenario) {
  if (scenario.value === next) return
  scenario.value = next
  selected.value = null
  stats.value = { fps: 0, calls: 0, triangles: 0 }
  createManager()
}

onMounted(() => {
  createManager()
  if (initialDeviceId) {
    manager.value?.select(initialDeviceId)
  }
})

onBeforeUnmount(() => {
  manager.value?.dispose()
  manager.value = undefined
})

function resetCamera() {
  manager.value?.resetCamera()
}

function closePanel() {
  selected.value = null
  manager.value?.select(null)
}

function exportDevices() {
  const header = '设备编号,设备名称,类型,状态,电压(kV),电流(A),负载(%)\n'
  const rows = currentScenario.value.devices
    .map((item) =>
      [item.id, item.name, item.type, statusLabels[item.status], item.voltage, item.current, item.load].join(','),
    )
    .join('\n')
  const blob = new Blob([`﻿${header}${rows}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = currentScenario.value.exportName
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="scene-page">
    <div ref="containerRef" class="canvas-host" />

    <div class="overlay scene-switch">
      <span v-if="scenario === 'substation'" class="station-badge">{{ station.name }}</span>
      <button
        v-for="item in scenarios"
        :key="item.key"
        type="button"
        class="switch-btn"
        :class="{ active: scenario === item.key }"
        @click="switchScenario(item.key)"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="overlay legend">
      <div class="legend-title">设备状态</div>
      <div v-for="item in legend" :key="item.status" class="legend-item">
        <span class="dot" :style="{ background: item.color }" />
        {{ item.label }}
      </div>
    </div>

    <div class="overlay stats">
      <span>FPS {{ stats.fps }}</span>
      <span>DrawCall {{ stats.calls }}</span>
      <span>三角面 {{ stats.triangles.toLocaleString() }}</span>
    </div>

    <transition name="slide">
      <aside v-if="selected" class="overlay detail">
        <header>
          <div>
            <div class="detail-name">{{ selected.name }}</div>
            <div class="detail-id">{{ selected.id }}</div>
          </div>
          <el-button link @click="closePanel">✕</el-button>
        </header>

        <div class="detail-status">
          <span class="dot" :style="{ background: legend.find((i) => i.status === selected?.status)?.color }" />
          {{ statusLabels[selected.status] }}
        </div>

        <dl>
          <div>
            <dt>电压</dt>
            <dd>{{ selected.voltage }} kV</dd>
          </div>
          <div>
            <dt>电流</dt>
            <dd>{{ selected.current }} A</dd>
          </div>
          <div>
            <dt>负载率</dt>
            <dd>{{ selected.load }} %</dd>
          </div>
          <div>
            <dt>坐标</dt>
            <dd>{{ selected.lng.toFixed(4) }}, {{ selected.lat.toFixed(4) }}</dd>
          </div>
        </dl>

        <div class="meter">
          <div class="meter-bar" :style="{ width: `${selected.load}%` }" />
        </div>
      </aside>
    </transition>

    <div class="overlay toolbar">
      <el-button size="small" @click="resetCamera">重置视角</el-button>
      <el-button v-permission="'device:export'" size="small" type="primary" plain @click="exportDevices">
        导出设备
      </el-button>
      <span class="tip">拖拽旋转 · 滚轮缩放 · 点击设备查看详情</span>
    </div>
  </div>
</template>

<style scoped>
.scene-page {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #081420;
}

.canvas-host {
  position: absolute;
  inset: 0;
}

.canvas-host :deep(canvas) {
  display: block;
}

.overlay {
  position: absolute;
  border: 1px solid var(--border-panel);
  border-radius: 10px;
  background: rgba(10, 22, 34, 0.78);
  backdrop-filter: blur(8px);
}

.scene-switch {
  top: 16px;
  left: 50%;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  transform: translateX(-50%);
}

.station-badge {
  display: flex;
  align-items: center;
  padding: 0 12px 0 14px;
  margin-right: 4px;
  border-right: 1px solid var(--border-panel);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--brand-cyan);
  white-space: nowrap;
}

.switch-btn {
  padding: 7px 18px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-sub);
  font-size: 12.5px;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

.switch-btn:hover {
  color: var(--text-main);
}

.switch-btn.active {
  background: rgba(54, 226, 208, 0.16);
  box-shadow: inset 0 0 0 1px rgba(54, 226, 208, 0.38);
  color: #dffbf7;
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
  box-shadow: 0 0 8px currentColor;
}

.stats {
  top: 16px;
  right: 16px;
  display: flex;
  gap: 14px;
  padding: 9px 14px;
  font-size: 12px;
  color: var(--brand-cyan);
  font-variant-numeric: tabular-nums;
}

.detail {
  top: 70px;
  right: 16px;
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

.meter {
  height: 5px;
  margin-top: 16px;
  border-radius: 3px;
  background: rgba(64, 158, 255, 0.15);
  overflow: hidden;
}

.meter-bar {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand), var(--brand-cyan));
  transition: width 0.3s;
}

.toolbar {
  bottom: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
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
