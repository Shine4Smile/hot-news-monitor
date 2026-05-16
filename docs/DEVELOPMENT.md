# HotPulse — 开发指南

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

# 2. 配置环境变量 & 初始化数据库
cp .env.example .env
# 编辑 .env，至少填入 DEEPSEEK_API_KEY
npx prisma db push

# 3. 安装前端依赖
cd ../client
npm install

# 4. 启动后端（端口 3001）
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
- **代理**: 前端 `/api/*` 请求通过 Vite proxy 转发到后端 3001 端口

## 项目命令

### 后端 (server/)

```bash
npm run dev        # 开发模式（热重载）
npm run build      # TypeScript 编译
npm run start      # 生产模式
npm run db:push    # 推送 Schema 到数据库
npm run db:migrate # 创建数据库迁移
npm run db:generate # 生成 Prisma Client
npm run db:studio  # 可视化数据库管理
npm run test       # 运行测试
```

### 前端 (client/)

```bash
npm run dev     # 开发模式
npm run build   # 生产构建
npm run preview # 预览生产构建
npm run lint    # 代码检查
```

## 数据库

使用 **Prisma ORM + SQLite**，数据文件位于 `server/prisma/dev.db`。

### Schema 管理

```bash
# 修改 prisma/schema.prisma 后：
npx prisma db push          # 直接同步（开发用）
npx prisma migrate dev      # 生成迁移文件（推荐）
npx prisma studio           # 可视化浏览数据
```

### 核心表

| 表 | 说明 |
|---|---|
| `Keyword` | 监控关键词，支持启用/停用、分类 |
| `Hotspot` | 发现的热点，含 AI 分析结果和多平台互动指标 |
| `Notification` | 通知记录（热点发现、告警） |
| `Setting` | 系统设置（键值对） |

## AI 对接

使用原生 `fetch` 直接调用 DeepSeek API（OpenAI 兼容格式）。

```typescript
// server/src/services/ai.ts

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

async function callDeepSeek(messages, options) {
  const res = await fetch(DEEPSEEK_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 500
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
```

### 两个 AI 功能

1. **Query Expansion（查询扩展）** — 将关键词扩展为 5-15 个变体（含别称、缩写、中英文对照等），用于文本预过滤。结果带内存缓存，同一关键词不会重复调用 AI。
2. **Content Analysis（内容分析）** — 判断内容是否与关键词相关（0-100 分），评估真实性和重要程度（low/medium/high/urgent），检测关键词是否被直接提及，输出结构化 JSON 含理由和摘要。

### 降级策略

如果未配置 `DEEPSEEK_API_KEY`:
- Query Expansion 回退到纯文本拆分（按空格/连字符/下划线分词）
- Content Analysis 返回默认分数（预匹配命中 50 分，未命中 20 分）
- 系统其余功能正常运行

## 数据源

当前已接入的搜索源：

| # | 源 | 类型 | 状态 | 实现文件 |
|---|---|---|---|---|
| 1 | **Bing** | 搜索引擎 | ✅ | `services/search.ts` |
| 2 | **搜狗** | 搜索引擎 | ✅ | `services/chinaSearch.ts` |
| 3 | **Bilibili** | 视频平台 | ✅ | `services/chinaSearch.ts` |
| 4 | **微博** | 社交平台 | ✅ | `services/chinaSearch.ts` |
| 5 | **Hacker News** | 技术社区 | ✅ | `services/search.ts` |
| 6 | **Twitter (X)** | 社交平台 | ⏸️ 已停用 | `services/twitter.ts` |

### 搜索流程

```
Cron 触发 → 读取激活关键词
  └─ 对每个关键词:
       ├─ AI Query Expansion（扩展关键词变体）
       ├─ 并行搜索 6 个数据源
       ├─ 账号自动检测（B站/微博）
       ├─ 去重 → 新鲜度过滤（7天内）
       ├─ 来源优先级排序
       ├─ AI 内容分析（relevance + importance + keywordMentioned）
       ├─ 相关性过滤（<50分丢弃，未提及且<65分丢弃）
       └─ 入库 + WebSocket 推送 + 邮件通知（高重要度）
```

## 定时任务

| 任务 | 间隔 | 说明 |
|---|---|---|
| 热点检查 | 30 分钟 | 对所有激活关键词执行搜索+AI分析 |

## 实时推送

使用 **Socket.IO** 进行 WebSocket 双向通信：

```typescript
// 前端连接（client/src/services/socket.ts）
import { io } from 'socket.io-client';
export const socket = io('http://localhost:3001');

// 订阅特定关键词的频道
socket.emit('subscribe', ['GPT-5', 'DeepSeek']);

// 监听新热点事件
socket.on('hotspot:new', (hotspot) => { /* 更新 UI */ });

// 监听通知事件
socket.on('notification', (notif) => { /* 弹窗提示 */ });
```

## 前端样式系统

使用 **Tailwind CSS v4** + 自定义 UI 动画组件（基于 Aceternity UI）：

| 组件 | 效果 |
|---|---|
| `background-beams.tsx` | 动态光束背景 |
| `meteors.tsx` | 流星划过效果 |
| `moving-border.tsx` | 流动边框动画 |
| `spotlight.tsx` | 聚光灯跟随鼠标 |
| `text-generate-effect.tsx` | 文字逐字生成效果 |

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | SQLite 数据库路径 |
| `PORT` | 否 | 后端端口（默认 3001） |
| `CLIENT_URL` | 否 | 前端地址（默认 http://localhost:5173） |
| `DEEPSEEK_API_KEY` | 推荐 | DeepSeek API Key |
| `TWITTER_API_KEY` | 否 | Twitter API Key（已停用） |
| `SMTP_HOST` | 否 | 邮件服务器地址 |
| `SMTP_PORT` | 否 | 邮件服务器端口 |
| `SMTP_USER` | 否 | 邮件账号 |
| `SMTP_PASS` | 否 | 邮件密码 |
| `NOTIFY_EMAIL` | 否 | 接收通知的邮箱 |

## Git 规范

### 提交内容

| 文件类型 | 是否提交 |
|---|---|
| 源代码 (.ts, .tsx, .css, .html) | ✅ |
| 配置文件 (package.json, tsconfig, vite.config) | ✅ |
| Prisma Schema + 迁移文件 | ✅ |
| 环境变量模板 (.env.example) | ✅ |
| 文档 (.md) | ✅ |
| 环境变量 (.env) | ❌ 含 API Key |
| 依赖 (node_modules/) | ❌ 体积大 |
| 数据库文件 (*.db) | ❌ 运行时数据 |
| 构建产物 (dist/) | ❌ 可重新构建 |

### 首次提交前检查

```bash
git status  # 确认没有 .env、node_modules、*.db 等文件被跟踪
```

