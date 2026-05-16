# 热点监控系统 — 技术设计文档

## 一、技术栈

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 前端 | React + TypeScript + Vite | React 19, Vite 7 | 快速开发、HMR |
| 样式 | 纯 CSS（自建工具类） | — | 无框架依赖，赛博脉冲主题 |
| 后端 | Node.js + Express | 5.x | 轻量 API 服务 |
| 数据库 | SQLite (better-sqlite3) | 11.x | 零配置、同步 API |
| AI | DeepSeek API (OpenAI SDK) | latest | 兼容 OpenAI 格式 |
| 定时任务 | node-cron | 3.x | Cron 表达式调度 |
| 实时推送 | SSE (Server-Sent Events) | 原生 | 单向推送、简单可靠 |
| 运行时 | tsx | latest | TypeScript 直接运行 |

## 二、架构图

```
┌─────────────────────────────────────────────────┐
│              浏览器 (React SPA)                   │
│  ┌────────┬────────┬────────┬──────────────┐    │
│  │ 关键词  │ 热点   │ 通知   │ 统计面板     │    │
│  │ 管理   │ 看板   │ 中心   │ (AI验证状态)  │    │
│  └────────┴────────┴────────┴──────────────┘    │
│         │  SSE (实时推送)  │  REST API          │
└─────────┼──────────────────┼───────────────────┘
          │                  │
┌─────────┴──────────────────┴───────────────────┐
│            Express 5 后端服务                     │
│  ┌──────────┬──────────┬──────────────────┐     │
│  │ REST API │ SSE Hub  │ Cron Scheduler   │     │
│  │ Routes   │ (推送)    │ (定时采集/验证)   │     │
│  └──────────┴──────────┴──────────────────┘     │
│  ┌──────────────────────────────────────────┐   │
│  │          Service Layer                    │   │
│  │  ┌──────────┬──────────┬──────────┐      │   │
│  │  │ Collector │ AI Verify │ Notifier │      │   │
│  │  │ (多源采集) │(DeepSeek) │ (推送)   │      │   │
│  │  └──────────┴──────────┴──────────┘      │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │      better-sqlite3 (SQLite)              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────┐
  │   DeepSeek API     │
  │ (验证 + 摘要)      │
  └───────────────────┘
```

## 三、数据库设计

### keywords 表

```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  category TEXT DEFAULT '通用',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### hotspots 表

```sql
CREATE TABLE hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  source_url TEXT,
  keyword_match TEXT,
  ai_verified INTEGER DEFAULT 0,
  ai_score REAL DEFAULT 0,
  ai_summary TEXT,
  is_fake INTEGER DEFAULT 0,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### notifications 表

```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'hotspot',
  title TEXT NOT NULL,
  message TEXT,
  hotspot_id INTEGER,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hotspot_id) REFERENCES hotspots(id)
);
```

## 四、API 设计

### 关键词管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/keywords` | 获取关键词列表 |
| POST | `/api/keywords` | 添加关键词 |
| PUT | `/api/keywords/:id` | 更新关键词 |
| DELETE | `/api/keywords/:id` | 删除关键词 |
| POST | `/api/keywords/:id/scan` | 手动触发扫描 |

### 热点管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hotspots` | 获取热点列表（支持 ?category=&verified=&page=&limit=） |
| GET | `/api/hotspots/:id` | 获取热点详情 |
| POST | `/api/hotspots/discover` | 手动触发热点发现 |
| DELETE | `/api/hotspots/:id` | 删除热点 |

### 通知管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/notifications` | 获取通知列表 |
| PUT | `/api/notifications/:id/read` | 标记已读 |
| PUT | `/api/notifications/read-all` | 全部标记已读 |
| GET | `/api/notifications/unread-count` | 未读数 |

### 实时推送

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/stream` | SSE 连接，推送新热点和通知 |

### 统计

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/stats` | 获取统计数据概览 |

## 五、DeepSeek AI 对接

```typescript
// 使用 OpenAI SDK 对接 DeepSeek
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// 验证热点内容是否与关键词相关
async function verifyHotspot(title: string, content: string, keyword: string) {
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: `你是一个内容审核助手...` },
      { role: 'user', content: `验证以下内容是否与"${keyword}"相关...` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  return JSON.parse(response.choices[0].message.content);
}
```

## 六、定时任务设计

```typescript
import cron from 'node-cron';

// 每 5 分钟采集一次热点
cron.schedule('*/5 * * * *', async () => {
  await collectHotspots();
});

// 每 10 分钟验证一次未验证的热点
cron.schedule('*/10 * * * *', async () => {
  await verifyPendingHotspots();
});
```

## 七、前端 UI 设计理念

风格：**Cyberspace Pulse（赛博脉冲）**

- 深色主题为主，霓虹色点缀
- 脉冲动画表示实时监控状态
- 卡片悬浮效果 + 玻璃态面板
- 独特的网格背景 + 粒子效果
- 热力波纹表示热点热度

主要页面/模块：
1. **监控面板** — 实时状态、关键词列表、快速添加
2. **热点看板** — 卡片流展示、AI 验证标记、热度排序
3. **通知中心** — 时间线展示、未读高亮
4. **统计视图** — 简单数据图表

## 八、项目结构

```
hot-news-monitor/
├── docs/
│   ├── REQUIREMENTS.md
│   └── DESIGN.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          # 入口
│   │   ├── db.ts             # 数据库初始化
│   │   ├── routes/
│   │   │   ├── keywords.ts
│   │   │   ├── hotspots.ts
│   │   │   ├── notifications.ts
│   │   │   ├── stream.ts
│   │   │   └── stats.ts
│   │   ├── services/
│   │   │   ├── collector.ts   # 多源采集
│   │   │   ├── verifier.ts    # AI 验证
│   │   │   └── scheduler.ts   # 定时任务
│   │   └── lib/
│   │       ├── deepseek.ts    # DeepSeek 客户端
│   │       └── sse.ts         # SSE 管理
│   └── data/                  # SQLite 数据文件
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── KeywordManager.tsx
│   │   │   ├── HotspotBoard.tsx
│   │   │   ├── NotificationCenter.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   └── PulseBackground.tsx
│   │   ├── hooks/
│   │   │   ├── useSSE.ts
│   │   │   └── useApi.ts
│   │   └── types/
│   │       └── index.ts
│   └── public/
└── skills/                    # Agent Skills (Phase 5)
    └── hot-news-monitor/
        └── SKILL.md
```

## 九、开发顺序

| Phase | 内容 | 预计 |
|---|---|---|
| Phase 1 | 后端骨架 + 数据库 + DeepSeek 客户端 | 先做 |
| Phase 2 | 前端 Web 独特 UI | 后做 |
| Phase 3 | 定时采集 + AI 验证 + SSE 通知 | 串联 |
| Phase 4 | 联调测试 + Bug 修复 | 验收 |
| Phase 5 | Agent Skills 封装 | 收尾 |
