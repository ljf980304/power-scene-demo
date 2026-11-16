<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { Role } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: 'admin', password: '123456' })

const registerVisible = ref(false)
const registerRef = ref<FormInstance>()
const registerLoading = ref(false)
const registerForm = reactive({
  username: '',
  name: '',
  password: '',
  confirm: '',
  role: 'operator' as Role,
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/,
      message: '3-20 位，字母开头，只能包含字母、数字、下划线',
      trigger: 'blur',
    },
  ],
  name: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码 6-20 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== registerForm.password) {
          callback(new Error('两次输入的密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

function fill(username: string) {
  form.username = username
  form.password = '123456'
}

function safeRedirect(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  if (raw === '/login' || raw === '/403') return '/'
  return raw
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    ElMessage.error((error as Error).message)
  } finally {
    loading.value = false
  }
}

function openRegister() {
  registerForm.username = ''
  registerForm.name = ''
  registerForm.password = ''
  registerForm.confirm = ''
  registerForm.role = 'operator'
  registerVisible.value = true
  // 弹窗里的表单要等下一帧才挂载，此时才能清掉上一次的校验状态
  nextTick(() => registerRef.value?.clearValidate())
}

async function handleRegister() {
  if (!registerRef.value) return
  const valid = await registerRef.value.validate().catch(() => false)
  if (!valid) return

  registerLoading.value = true
  try {
    await userStore.register({
      username: registerForm.username.trim(),
      name: registerForm.name.trim(),
      password: registerForm.password,
      role: registerForm.role,
    })
    registerVisible.value = false
    ElMessage.success('注册成功，已自动登录')
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    ElMessage.error((error as Error).message)
  } finally {
    registerLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-glow" />

    <section class="intro">
      <div class="intro-badge">POWER SCENE</div>
      <h1>电网三维可视化平台</h1>
      <p>
        覆盖「区域电网 → 变电站内部 → 配电台区」三层视图，<br />
        基于 Three.js 与 MapLibre，串起输电、变电、配电到入户的整条链路。
      </p>
      <ul>
        <li>区域电网：变电站、输电线路、铁塔与 10kV 台区</li>
        <li>站内场景：主变、母线、开关柜的三维拾取</li>
        <li>权限体系：路由级 + 按钮级</li>
      </ul>
    </section>

    <section class="panel">
      <h2>账号登录</h2>
      <p class="panel-sub">演示账号可直接登录，也可以注册自己的账号</p>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button class="submit" type="primary" :loading="loading" @click="handleLogin">登 录</el-button>
      </el-form>

      <div class="hints">
        <span>快捷填充：</span>
        <el-button link type="primary" @click="fill('admin')">管理员</el-button>
        <el-button link type="primary" @click="fill('operator')">值班员</el-button>
        <span class="pwd">密码均为 123456</span>
      </div>

      <div class="register-entry">
        <span>还没有账号？</span>
        <el-button link type="primary" @click="openRegister">注册一个演示账号</el-button>
      </div>

      <p class="notice">纯前端模拟，账号只保存在本机浏览器里，刷新仍在、换设备即失效。请勿使用真实密码。</p>
    </section>

    <el-dialog
      v-model="registerVisible"
      title="注册演示账号"
      width="420px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form ref="registerRef" :model="registerForm" :rules="registerRules" label-width="76px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="registerForm.username" placeholder="字母开头，3-20 位" />
        </el-form-item>
        <el-form-item label="昵称" prop="name">
          <el-input v-model="registerForm.name" placeholder="显示在右上角的名字" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="registerForm.password" type="password" placeholder="6-20 位" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm">
          <el-input v-model="registerForm.confirm" type="password" placeholder="再输入一次" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="registerForm.role">
            <el-radio-button value="admin">系统管理员</el-radio-button>
            <el-radio-button value="operator">运维值班员</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <p class="role-tip">
          角色决定可见的菜单和按钮：管理员多一个「告警中心」，并多出导出、告警确认两个按钮；值班员只有查看和场景控制。
        </p>
      </el-form>

      <template #footer>
        <el-button @click="registerVisible = false">取消</el-button>
        <el-button type="primary" :loading="registerLoading" @click="handleRegister">注册并登录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 90px;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 20%, rgba(47, 155, 255, 0.18), transparent 42%),
    radial-gradient(circle at 82% 78%, rgba(54, 226, 208, 0.12), transparent 45%),
    #08121d;
}

.login-glow {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(47, 155, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(47, 155, 255, 0.055) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at center, #000 30%, transparent 78%);
  pointer-events: none;
}

.intro {
  position: relative;
  max-width: 440px;
}

.intro-badge {
  display: inline-block;
  padding: 4px 10px;
  margin-bottom: 18px;
  border: 1px solid rgba(54, 226, 208, 0.4);
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--brand-cyan);
}

.intro h1 {
  margin: 0 0 16px;
  font-size: 32px;
  letter-spacing: 1px;
}

.intro p {
  margin: 0 0 22px;
  line-height: 1.9;
  font-size: 14px;
  color: var(--text-sub);
}

.intro ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--text-sub);
}

.intro li {
  position: relative;
  padding-left: 16px;
  margin-bottom: 9px;
}

.intro li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand-cyan);
}

.panel {
  position: relative;
  width: 360px;
  padding: 32px 30px 26px;
  border: 1px solid var(--border-panel);
  border-radius: 16px;
  background: rgba(13, 27, 42, 0.82);
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
}

.panel h2 {
  margin: 0;
  font-size: 20px;
}

.panel-sub {
  margin: 6px 0 24px;
  font-size: 12.5px;
  color: var(--text-sub);
}

.submit {
  width: 100%;
  margin-top: 6px;
}

.hints {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 18px;
  font-size: 12px;
  color: var(--text-sub);
}

.hints .pwd {
  margin-left: auto;
}

.register-entry {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--text-sub);
}

.notice {
  margin: 14px 0 0;
  padding-top: 12px;
  border-top: 1px dashed var(--border-panel);
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--text-sub);
  opacity: 0.85;
}

.role-tip {
  margin: 4px 0 0 76px;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--text-sub);
}

@media (max-width: 900px) {
  .login-page {
    gap: 0;
    padding: 20px;
  }

  .intro {
    display: none;
  }
}
</style>
