<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { alarmPool, initialAlarms } from '@/mock/devices'
import type { Alarm } from '@/types'

const list = ref<Alarm[]>([...initialAlarms])
let timer: number | undefined
let seq = initialAlarms.length

function pushAlarm() {
  const template = alarmPool[seq % alarmPool.length]
  seq += 1
  const now = new Date()
  list.value.unshift({
    ...template,
    id: `AL-${String(seq).padStart(3, '0')}`,
    time: now.toLocaleTimeString('zh-CN', { hour12: false }),
  })
  if (list.value.length > 12) {
    list.value.pop()
  }
}

function ack(item: Alarm) {
  list.value = list.value.filter((alarm) => alarm.id !== item.id)
  ElMessage.success(`已确认告警：${item.deviceName}`)
}

onMounted(() => {
  timer = window.setInterval(pushAlarm, 5000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="alarm-page">
    <div class="toolbar">
      <span class="hint">模拟告警每 5 秒推送一条；「确认」按钮仅管理员可见（v-permission）。</span>
      <el-button v-permission="'alarm:ack'" type="primary" plain size="small" @click="pushAlarm">
        手动推送
      </el-button>
    </div>

    <el-table :data="list" size="default" height="calc(100vh - 210px)">
      <el-table-column prop="time" label="时间" width="110" />
      <el-table-column prop="deviceName" label="设备" min-width="160" />
      <el-table-column label="级别" width="100">
        <template #default="{ row }">
          <el-tag :type="row.level === 'fault' ? 'danger' : 'warning'" size="small" effect="dark">
            {{ row.level === 'fault' ? '故障' : '告警' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="告警内容" min-width="220" />
      <el-table-column label="操作" width="110" align="right">
        <template #default="{ row }">
          <el-button v-permission="'alarm:ack'" link type="primary" @click="ack(row)">确认</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.alarm-page {
  padding: 18px 22px 24px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.hint {
  font-size: 12.5px;
  color: var(--text-sub);
}
</style>
