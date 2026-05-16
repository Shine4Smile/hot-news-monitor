# HotPulse — 技术设计文档

## 一、技术栈

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 前端 | React + TypeScript + Vite | React 19, Vite 7 | SPA, HMR |
| 样式 | Tailwind CSS v4 + Aceternity UI | latest | 原子化 CSS + 高级动画组件 |
| 后端 | Node.js + Express | 5.x | 轻量 API 服务 |
| 数据库 | Prisma ORM + SQLite | Prisma 6.x | 类型安全 ORM |
| AI | DeepSeek API (原生 fetch) | — | OpenAI 兼容格式 |
| 定时任务 | node-cron | 4.x | Cron 表达式调度 |
| 实时推送 | Socket.IO (WebSocket) | 4.x | 双向实时通信 |
| 运行时 | tsx | latest | TypeScript 直接运行 |

## 二、架构图

```
┌─────────────────────────────────────────────────┐
│              浏览器 (React SPA)                   │
│  ┌────────┬────────┬────────┬──────────────┐    │
│  │ 热点雷达 │ 监控词  │ 搜索   │ 通知中心     │    │
│  │ 看板   │ 管理   │ 扩展   │              │    │
│  └────────┴────────┴────────┴──────────────┘    │
│         │  WebSocket (Socket.IO)  │  REST API   │
└─────────┼─────────────────────────┼─────────────┘
          │                         │
┌─────────┴─────────────────────────┴─────────────┐
│            Express 5 后端服务                     │
│  ┌──────────┬──────────────┬────────────────┐   │
│  │ REST API │ Socket.IO    │ Cron Scheduler │   │
│  │ Routes   │ (实时推送)    │ (每30分钟扫描)  │   │
│  └──────────┴──────────────┴────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │          Service Layer                    │   │
│  │  ┌──────────┬──────────┬──────────┐      │   │
│  │  │ ai.ts    │ search   │ email    │      │   │
│  │  │(DeepSeek)│ .ts      │ .ts      │      │   │
│  │  │          │(Bing+HN) │(邮件通知) │      │   │
│  │  ├──────────┼──────────┼──────────┤      │   │
│  │  │ china    │ twitter  │          │      │   │
│  │  │ Search.ts│ .ts      │          │      │   │
│  │  │(搜狗+B站 │(已停用)  │          │      │   │
│  │  │ +微博)   │          │          │      │   │
│  │  └──────────┴──────────┴──────────┘      │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │      Prisma ORM + SQLite                  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
          │                               │
          ▼                               ▼
  ┌──────────────┐              ┌───────────────────┐
  │ DeepSeek API  │              │  5 个搜索源 (HTTP) │
  │ (Query Exp.   │              │  Bing · 搜狗 · B站 │
  │  + 内容分析)  │              │  微博 · HN         │
  └──────────────┘              └───────────────────┘
```

### 数据源详情

| # | 数据源 | 类型 | 实现 | 状态 |
|---|---|---|---|---|
| 1 | **Bing** | 搜索引擎 | `services/search.ts` — cheerio HTML 解析 | ✅ |
| 2 | **搜狗** | 搜索引擎 | `services/chinaSearch.ts` — cheerio HTML 解析 | ✅ |
| 3 | **Bilibili** | 视频平台 | `services/chinaSearch.ts` — 网页搜索 API | ✅ |
| 4 | **微博** | 社交平台 | `services/chinaSearch.ts` — 热搜 API | ✅ |
| 5 | **Hacker News** | 技术社区 | `services/search.ts` — Algolia API | ✅ |
| 6 | **Twitter (X)** | 社交平台 | `services/twitter.ts` — twitterapi.io | ⏸️ 已停用 |

- Twitter 通过 twitterapi.io 付费 API 接入，需要 `TWITTER_API_KEY`
- 其他源均为免费公开接口，无需 API Key
- 搜索时各源并行请求，`Promise.allSettled` 保证单源失败不影响其他

## 三、数据库设计 (Prisma Schema)

```prisma
model Keyword {
  id        String    @id @default(uuid())
  text      String    @unique
  category  String?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  hotspots  Hotspot[]
}

model Hotspot {
  id              String    @id @default(uuid())
  title           String
  content         String
  url             String
  source          String    // bing, sogou, bilibili, weibo, hackernews, twitter
  sourceId        String?   // 源平台ID
  isReal          Boolean   @default(true)
  relevance       Int       @default(0)       // AI 相关性评分 0-100
  relevanceReason String?                      // AI 分析理由
  keywordMentioned Boolean?                    // 是否直接提及关键词
  importance      String    @default("low")    // low/medium/high/urgent
  summary         String?                      // AI 生成摘要
  // 多平台互动指标
  viewCount       Int?
  likeCount       Int?
  retweetCount    Int?
  replyCount      Int?
  commentCount    Int?
  quoteCount      Int?
  danmakuCount    Int?      // B站弹幕数
  // 作者信息
  authorName      String?
  authorUsername  String?
  authorAvatar    String?
  authorFollowers Int?
  authorVerified  Boolean?
  publishedAt     DateTime?
  createdAt       DateTime  @default(now())
  keywordId       String?
  keyword         Keyword?  @relation(fields: [keywordId], references: [id])

  @@unique([url, source])  // 同一来源同一URL不重复
}

model Notification {
  id        String   @id @default(uuid())
  type      String   // hotspot, alert
  title     String
  content   String
  isRead    Boolean  @default(false)
  hotspotId String?
  createdAt DateTime @default(now())
}

model Setting {
  id    String @id @default(uuid())
  key   String @unique
  value String
}
```

### 关键设计决策

- **UUID 主键**: 支持分布式扩展
- **@@unique([url, source])**: 防止同一页面被重复入库
- **keywordMentioned**: 区分"内容涉及该领域"和"内容直接提到关键词"
- **多平台指标**: 统一字段名，不同平台对应不同字段（如 Twitter 用 retweetCount，B站用 danmakuCount）

## 四、API 设计

### 关键词管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/keywords` | 获取关键词列表 |
| POST | `/api/keywords` | 添加关键词 |
| PUT | `/api/keywords/:id` | 更新关键词（启用/停用） |
| DELETE | `/api/keywords/:id` | 删除关键词 |

### 热点管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hotspots` | 获取热点列表（支持排序、筛选、分页） |
| GET | `/api/hotspots/:id` | 获取热点详情 |
| DELETE | `/api/hotspots/:id` | 删除热点 |

### 通知管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/notifications` | 获取通知列表 |
| PUT | `/api/notifications/:id/read` | 标记已读 |
| PUT | `/api/notifications/read-all` | 全部已读 |
| GET | `/api/notifications/unread-count` | 未读数 |

### 设置管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/settings` | 获取所有设置 |
| PUT | `/api/settings` | 更新设置 |

### 手动触发

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/check-hotspots` | 手动触发全量热点扫描 |

### 实时推送 (WebSocket 事件)

| 事件 | 方向 | 说明 |
|---|---|---|
| `subscribe` | Client→Server | 订阅关键词频道 |
| `unsubscribe` | Client→Server | 取消订阅 |
| `hotspot:new` | Server→Client | 新热点发现 |
| `notification` | Server→Client | 新通知 |

## 五、DeepSeek AI 对接

使用原生 `fetch` 直接调用（零依赖）：

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

### 功能 1：Query Expansion（查询扩展）

输入关键词 → AI 生成 5-15 个变体 → 用于文本预匹配

- 含原始词的各种写法、核心拆分、常见别称、中英文对照
- 结果带 Map 缓存，同一关键词全局只调用一次 AI
- 无 API Key 时回退为纯文本拆分

### 功能 2：Content Analysis（内容分析）

输入内容 + 关键词 + 预匹配结果 → AI 返回结构化 JSON：

```json
{
  "isReal": true,           // 是否真实信息（非标题党/假新闻/营销软文）
  "relevance": 85,          // 相关性 0-100
  "relevanceReason": "...", // 打分理由
  "keywordMentioned": true, // 是否直接提及关键词
  "importance": "high",     // low/medium/high/urgent
  "summary": "此内容与【关键词】的关联：..." // 关联说明
}
```

### 过滤规则

```
relevance < 50                          → 丢弃
keywordMentioned=false && relevance < 65 → 丢弃
isReal = false                          → 丢弃
```

## 六、热点扫描流程

```
Cron (每30分钟) 或 POST /api/check-hotspots
  │
  ├─ 读取所有 isActive=true 的关键词
  │
  └─ 对每个关键词:
       │
       ├─ 1. Account Detection: 检测关键词是否为B站/微博账号
       │
       ├─ 2. Query Expansion: AI 扩展关键词变体
       │
       ├─ 3. 并行搜索 5 个源 (Promise.allSettled)
       │    ├─ searchBing(keyword)
       │    ├─ searchHackerNews(keyword)
       │    ├─ searchSogou(keyword)
       │    ├─ searchBilibili(keyword)
       │    └─ searchWeibo(keyword)
       │
       ├─ 4. 后处理流水线
       │    ├─ 账号抓取结果合并
       │    ├─ deduplicateResults (按URL去重)
       │    ├─ filterByFreshness (丢弃7天前)
       │    └─ prioritizeResults (Weibo>Bilibili>HN>Sogou>Bing)
       │
       ├─ 5. AI 分析 (每批3条并行，限总配额25条)
       │    ├─ preMatchKeyword (文本预匹配，快速过滤)
       │    ├─ analyzeContent (DeepSeek 深度分析)
       │    └─ 按 relevance/mention 规则过滤
       │
       └─ 6. 结果处理
            ├─ 写入 Hotspot 表
            ├─ 创建 Notification
            ├─ WebSocket 推送 (hotspot:new + notification)
            └─ 邮件通知 (importance=high/urgent)
```

## 七、前端 UI 设计

**风格**: 深色赛博主题 + Tailwind CSS + Aceternity UI 动画组件

核心组件：
| 组件 | 效果 |
|---|---|
| `background-beams` | 动态光束背景动画 |
| `meteors` | 流星飞过效果 |
| `moving-border` | 流动边框高亮 |
| `spotlight` | 鼠标聚光灯跟随 |
| `text-generate-effect` | 文字逐字生成 |

功能模块：
1. **热点雷达** — 实时热点流、统计面板、排序筛选
2. **监控词管理** — 添加/编辑/启用停用关键词
3. **搜索扩展** — 手动搜索 + AI 分析预览
4. **通知中心** — 未读高亮、时间线展示

## 八、项目结构

```
hot-news-monitor/
├── README.md
├── docs/
│   ├── REQUIREMENTS.md
│   ├── DESIGN.md
│   └── DEVELOPMENT.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma.config.ts
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.ts              # 入口: Express + Socket.IO + Cron
│       ├── db.ts                 # Prisma Client 单例
│       ├── types.ts              # 共享类型定义
│       ├── routes/
│       │   ├── keywords.ts
│       │   ├── hotspots.ts
│       │   ├── notifications.ts
│       │   └── settings.ts
│       ├── services/
│       │   ├── ai.ts             # DeepSeek API (fetch)
│       │   ├── search.ts         # Bing + HackerNews
│       │   ├── chinaSearch.ts    # 搜狗 + B站 + 微博
│       │   ├── twitter.ts        # Twitter (已停用)
│       │   └── email.ts          # 邮件通知
│       ├── jobs/
│       │   └── hotspotChecker.ts # 热点扫描主流程
│       └── utils/
│           └── sortHotspots.ts
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css             # Tailwind CSS
        ├── components/
        │   ├── FilterSortBar.tsx
        │   └── ui/               # Aceternity UI 组件
        │       ├── background-beams.tsx
        │       ├── meteors.tsx
        │       ├── moving-border.tsx
        │       ├── spotlight.tsx
        │       └── text-generate-effect.tsx
        ├── services/
        │   ├── api.ts            # REST API 封装
        │   └── socket.ts         # Socket.IO 客户端
        └── utils/
            ├── relativeTime.ts
            └── sortHotspots.ts
```

