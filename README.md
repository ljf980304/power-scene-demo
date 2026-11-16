# 电网三维可视化平台

基于 Three.js 与 MapLibre GL 的电网可视化示例，覆盖「区域电网 → 变电站内部 → 配电台区」三层视图，含登录鉴权、动态路由与按钮级权限。

## 在线预览

部署后填写：`https://<your-site>.netlify.app`

演示账号：

| 账号 | 密码 | 角色 | 可见范围 |
|---|---|---|---|
| `admin` | `123456` | 系统管理员 | 全部菜单 + 导出、告警确认 |
| `operator` | `123456` | 运维值班员 | 无「告警中心」，无导出/确认按钮 |

登录后可在右上角「切换角色」直接体验菜单与按钮的实时变化。

## 技术栈

- Vue 3（`<script setup>`）+ TypeScript + Vite 5
- Pinia / Vue Router 4 / Element Plus
- Three.js（三维场景）/ MapLibre GL（三维地图）

## 功能

**三维场景（Three.js）**

- 程序化生成变电站：主变、开关柜、杆塔、母线、围墙，无外部模型依赖
- 按电压等级区分站内配置：220kV 站 3 台主变，110kV 站 2 台
- Raycaster 拾取：悬停高亮、点击选中、详情面板联动
- 告警状态着色，故障设备呼吸灯闪烁
- 母线流向动画（TubeGeometry + 纹理滚动）
- 实时性能面板：FPS / DrawCall / 三角面数

**区域电网（MapLibre GL）**

- 3 座变电站（220kV / 110kV）、2 条 110kV 联络线、8 基输电铁塔
- 8 个 10kV 配电台区，展示配变容量与 220V 入户户数
- 输电层 / 配电层独立开关，潮流方向沿线路流动
- 点击变电站进入站内三维场景，点击铁塔进入输电线路场景

**权限体系**

- 登录鉴权 + token 持久化 + 路由守卫
- 按角色动态生成路由与菜单（`meta.roles`）
- 按钮级权限指令 `v-permission`
- 403 / 404 兜底页

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5173
```

其他命令：

```bash
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览构建产物
npm run type-check   # 仅类型检查
```

> 需要 Node 18+。

## 部署

推送到主分支后由 Netlify 自动构建。`netlify.toml` 已配置 SPA 重写，刷新子路由不会 404。

## 说明

- 设备数据、告警数据均为前端 mock，无后端依赖
- 三维场景中的设备由基础几何体程序化拼装，不加载外部 GLB 模型
- 地图底图使用 CARTO 暗色栅格瓦片（公开服务，无需 token）
