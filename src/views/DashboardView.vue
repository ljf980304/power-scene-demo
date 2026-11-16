<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { distributions, distributionLines, substations, towers, transmissionLines } from '@/mock/grid'
import { initialAlarms } from '@/mock/devices'
import type { DeviceStatus, GridNode } from '@/types'

const router = useRouter()

const statusText: Record<DeviceStatus, string> = {
  normal: '正常',
  warning: '告警',
  fault: '故障',
  offline: '离线',
}

const statusType: Record<DeviceStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  normal: 'success',
  warning: 'warning',
  fault: 'danger',
  offline: 'info',
}

const households = distributions.reduce((sum, item) => sum + (item.count ?? 0), 0)

const stats = computed(() => [
  { label: '变电站', value: substations.length, unit: '座' },
  { label: '输电铁塔', value: towers.length, unit: '基' },
  { label: '配电台区', value: distributions.length, unit: '个' },
  { label: '供电户数', value: households.toLocaleString('zh-CN'), unit: '户' },
])

const networkSummary = computed(
  () => `输电线路 ${transmissionLines.length} 条 · 配电馈线 ${distributionLines.length} 条`,
)

const recentAlarms = initialAlarms.slice(0, 5)

function enterStation(id: string) {
  router.push({ path: '/scene', query: { scenario: 'substation', station: id } })
}

function handleRowClick(row: GridNode) {
  enterStation(row.id)
}
</script>

<template>
  <div class="dashboard">
    <div class="stats">
      <div v-for="item in stats" :key="item.label" class="stat-card">
        <div class="stat-label">{{ item.label }}</div>
        <div class="stat-value">
          {{ item.value }}
          <span class="stat-unit">{{ item.unit }}</span>
        </div>
      </div>
    </div>

    <div class="panels">
      <div class="panel">
        <div class="panel-head">
          <span>变电站</span>
          <span class="panel-sub">{{ networkSummary }}</span>
        </div>
        <el-table :data="substations" size="small" @row-click="handleRowClick">
          <el-table-column prop="name" label="变电站" min-width="150" />
          <el-table-column prop="owner" label="区域" width="80" />
          <el-table-column label="电压等级" width="96">
            <template #default="{ row }">
              <el-tag size="small" effect="dark" :type="row.voltage === '220kV' ? 'success' : 'primary'">
                {{ row.voltage }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="主变容量" width="96">
            <template #default="{ row }">{{ row.capacity }} MVA</template>
          </el-table-column>
          <el-table-column label="状态" width="84">
            <template #default="{ row }">
              <el-tag :type="statusType[row.status as DeviceStatus]" size="small" effect="dark">
                {{ statusText[row.status as DeviceStatus] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="92" align="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="enterStation(row.id)">进入三维</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-head">最近告警</div>
        <el-timeline class="alarm-timeline">
          <el-timeline-item
            v-for="item in recentAlarms"
            :key="item.id"
            :timestamp="item.time"
            :type="item.level === 'fault' ? 'danger' : 'warning'"
          >
            <div class="alarm-title">{{ item.deviceName }}</div>
            <div class="alarm-msg">{{ item.message }}</div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 20px 22px 28px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 16px 18px;
  border: 1px solid var(--border-panel);
  border-radius: 12px;
  background: var(--bg-panel);
}

.stat-label {
  font-size: 12.5px;
  color: var(--text-sub);
}

.stat-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 600;
  color: var(--brand-cyan);
}

.stat-unit {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-sub);
}

.panels {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 14px;
}

.panel {
  padding: 16px 18px;
  border: 1px solid var(--border-panel);
  border-radius: 12px;
  background: var(--bg-panel);
}

.panel-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
}

.panel-sub {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-sub);
}

:deep(.el-table__row) {
  cursor: pointer;
}

.alarm-timeline {
  padding-left: 4px;
}

.alarm-title {
  font-size: 13px;
}

.alarm-msg {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-sub);
}

@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panels {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
