# PulseScope — 开发指南

## 环境要求

| 工具 | 版本 |
|---|---|
| Node.js | >= 22.x |
| npm | >= 9.x |
| Git | >= 2.x |

## 本地开发

### 首次启动

```bash
# 1. 安装后端依赖
cd server
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填入 DEEPSEEK_API_KEY

# 3. 安装前端依赖
cd ../client
npm install

# 4. 启动后端（端口 3000）
cd ../server
npm run dev

# 5. 新终端，启动前端（端口 5173）
cd ../client
npm run dev
```

浏览器访问 `http://localhost:5173`

### 开发模式说明

- **后端**: `tsx watch` 监听文件变化自动重启
- **前端**: Vite HMR 热更新，修改即生效
- **代理**: 前端 `/api/*` 请求自动代理到后端 3000 端口

## 项目命令

### 后端 (server/)

```bash
npm run dev     # 开发模式（热重载）
npm run start   # 生产模式
```

### 前端 (client/)

```bash
npm run dev     # 开发模式
npm run build   # 生产构建
npm run preview # 预览生产构建
```

## 数据库

使用 SQLite（`better-sqlite3`），数据文件位于 `server/data/hotnews.db`。

首次启动自动建表，无需手动迁移。

### 表结构

- `keywords` — 监控关键词
- `hotspots` — 发现的热点（含 AI 验证结果）
- `notifications` — 通知记录

## AI 对接

使用 OpenAI SDK 对接 DeepSeek API（兼容格式）。

```typescript
// server/src/lib/deepseek.ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});
```

### 两个 AI 功能

1. **内容验证** (`verifyContent`): 判断热点是否与关键词真正相关、是否为虚假信息。使用 `response_format: json_object` 获得结构化输出。
2. **热点发现** (`discoverTrendingTopics`): 根据领域生成热门话题列表。

### 降级策略

如果未配置 `DEEPSEEK_API_KEY`:
- AI 验证跳过，所有热点标记为"未验证"
- 热点发现返回空列表
- 系统其余功能正常运行

## 信息源

当前使用内置模拟数据（覆盖 36氪、掘金、InfoQ 三个来源）。

### 扩展信息源

编辑 `server/src/services/collector.ts`，新增信息源对象：

```typescript
const NEW_SOURCE = {
  name: '来源名称',
  getHotspots: async (): Promise<MockHotspot[]> => [
    { title: '...', summary: '...', source: '来源名称' },
  ],
};
// 添加到 MOCK_SOURCES 数组
```

未来可替换为真实 web 抓取、RSS 订阅或 NewsAPI。

## 定时任务

| 任务 | 间隔 | 环境变量 |
|---|---|---|
| 热点采集 | 5 分钟 | `COLLECT_INTERVAL_MINUTES` |
| AI 验证 | 10 分钟 | `VERIFY_INTERVAL_MINUTES` |

定时任务在新热点入库时通过 SSE 实时推送到前端。

## 前端样式系统

不使用 TailwindCSS 等框架，采用纯 CSS 自建工具类系统。

### 设计 Token

定义在 `client/src/index.css` 的 `:root` 中：

```css
--cyber-bg: #0a0a0f;      /* 深空背景 */
--cyber-neon: #00f0ff;     /* 霓虹青 */
--cyber-pulse: #b347ea;    /* 脉冲紫 */
--cyber-warn: #ff6b35;     /* 警示橙 */
--cyber-ok: #00e676;       /* 翠绿 */
```

### 组件级样式

特殊视觉效果（玻璃态、脉冲动画、网格背景等）作为独立 CSS 类：

- `.glass-card` — 玻璃态卡片
- `.bg-cyber-grid` — 动态网格背景
- `.glow-neon` / `.glow-pulse` — 霓虹光晕
- `.tab-active` — 底部指示器

## Git 规范

### 提交内容

| 文件类型 | 是否提交 |
|---|---|
| 源代码 (.ts, .tsx, .css, .html) | ✅ |
| 配置文件 (package.json, tsconfig, vite.config) | ✅ |
| 环境变量模板 (.env.example) | ✅ |
| 文档 (.md) | ✅ |
| 环境变量 (.env) | ❌ 敏感信息 |
| 依赖 (node_modules/) | ❌ 体积大 |
| 数据库文件 (*.db) | ❌ 运行时数据 |
| 构建产物 (dist/) | ❌ 可重新构建 |

### 首次提交前检查

```bash
git status  # 确认没有 .env、node_modules、*.db 等文件被跟踪
```
