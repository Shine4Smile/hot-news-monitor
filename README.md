# 🔥 PulseScope — 热点监控系统

> 实时追踪热点 · AI 智能验真 · 即时推送通知

一个轻量级的热点新闻监控工具，利用 AI（DeepSeek）自动发现和验证热点信息，第一时间推送通知，让你走在吃瓜第一线。

---

## ✨ 功能特性

| 功能 | 说明 |
|---|---|
| 🎯 **关键词监控** | 手动输入关键词，系统自动从多源采集匹配内容 |
| 🤖 **AI 验真** | 利用 DeepSeek 识别假冒/标题党/无关内容 |
| 🔍 **热点发现** | 自动搜集指定领域（如"AI编程"）的热门话题 |
| 📡 **实时推送** | SSE 实时推送 + 浏览器通知 + 通知中心 |
| 🌐 **多源采集** | 从多个信息源获取，避免单一来源偏差 |
| 📱 **响应式设计** | 桌面 + 移动端完美适配，赛博脉冲风格 |

---

## 🏗️ 技术架构

```
┌──────────────────────────────────┐
│   React 19 + Vite 7 (纯 CSS)      │  ← 前端
│   赛博脉冲风格 · 粒子背景 · 玻璃态  │
└──────────────┬───────────────────┘
               │ REST API + SSE
┌──────────────┴───────────────────┐
│   Express 5 + TypeScript          │  ← 后端
│   SQLite · node-cron · SSE Hub    │
└──────────────┬───────────────────┘
               │
┌──────────────┴───────────────────┐
│   DeepSeek API (OpenAI 兼容)       │  ← AI 服务
│   内容验真 · 热点语义分析           │
└──────────────────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 22
- npm >= 9

### 1. 安装依赖

```bash
# 后端
cd server && npm install

# 前端
cd ../client && npm install
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
# 编辑 .env，填入 DeepSeek API Key
```

> 获取 API Key: https://platform.deepseek.com/api_keys
>
> 如不填 Key，系统仍可运行，但 AI 验证功能将跳过。

### 3. 启动服务

```bash
# 终端 1: 启动后端 (端口 3000)
cd server && npm run dev

# 终端 2: 启动前端 (端口 5173)
cd client && npm run dev
```

浏览器打开 `http://localhost:5173`

---

## 📁 项目结构

```
hot-news-monitor/
├── README.md
├── .gitignore
├── docs/
│   ├── REQUIREMENTS.md      # 需求文档
│   ├── DESIGN.md            # 设计文档
│   └── DEVELOPMENT.md       # 开发指南
├── server/                  # 后端
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example         # 环境变量模板
│   ├── .gitignore
│   └── src/
│       ├── index.ts         # 服务入口
│       ├── db.ts            # 数据库初始化
│       ├── routes/          # API 路由
│       │   ├── keywords.ts
│       │   ├── hotspots.ts
│       │   ├── notifications.ts
│       │   ├── stream.ts    # SSE 推送
│       │   └── stats.ts
│       ├── services/
│       │   ├── collector.ts # 多源采集
│       │   ├── verifier.ts  # AI 验证
│       │   └── scheduler.ts # 定时任务
│       └── lib/
│           ├── deepseek.ts  # DeepSeek 客户端
│           └── sse.ts       # SSE Hub
└── client/                  # 前端
    ├── package.json
    ├── vite.config.ts
    ├── .gitignore
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css        # 纯 CSS 样式系统
        ├── components/
        │   ├── ParticleBackground.tsx
        │   ├── KeywordManager.tsx
        │   ├── HotspotBoard.tsx
        │   └── NotificationCenter.tsx
        ├── hooks/
        │   ├── useApi.ts
        │   └── useSSE.ts
        └── types/
            └── index.ts
```

---

## 🔌 API 接口

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/stats` | 统计概览 |
| GET/POST | `/api/keywords` | 关键词 CRUD |
| PUT/DELETE | `/api/keywords/:id` | 更新/删除关键词 |
| GET | `/api/hotspots` | 热点列表（支持分页、筛选） |
| POST | `/api/hotspots/:id/verify` | AI 验证单条热点 |
| GET | `/api/notifications` | 通知列表 |
| PUT | `/api/notifications/:id/read` | 标记已读 |
| PUT | `/api/notifications/read-all` | 全部已读 |
| GET | `/api/notifications/unread-count` | 未读数量 |
| GET | `/api/stream` | SSE 实时推送 |
| POST | `/api/trigger/collect` | 手动触发采集 |
| POST | `/api/trigger/verify` | 手动触发验证 |

---

## 🎨 设计风格

- **名称**: Cyberspace Pulse（赛博脉冲）
- **配色**: 深空黑底 + 霓虹青 + 脉冲紫 + 警示橙 + 翠绿
- **特点**: 动态网格背景 · 粒子连线动画 · 玻璃态卡片 · 脉冲指示器

---

## 📄 文档

- [需求文档](docs/REQUIREMENTS.md)
- [设计文档](docs/DESIGN.md)
- [开发指南](docs/DEVELOPMENT.md)

