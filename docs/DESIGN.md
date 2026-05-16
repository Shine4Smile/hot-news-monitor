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

## 五、DeepSeek AI 校验体系

### 整体架构：两阶段过滤

```
搜索结果 → [阶段1: 文本预匹配] → [阶段2: AI 深度分析] → 入库/丢弃
```

### 阶段 1：Query Expansion + 文本预匹配

**目的**: 在调用 AI 之前，用低成本方式快速筛掉明显无关内容。

1. **Query Expansion（AI 驱动）**：将用户关键词扩展为 5-15 个变体
   - 含原始词各种写法（大小写、空格、连字符变体）
   - 核心组成词拆分 + 两两组合
   - 常见别称、缩写、中英文对照
   - **禁止泛化**：关键词是 "Claude Sonnet 4.6" 不会生成 "AI 模型" 这类泛化词
   - 结果带 Map 内存缓存，同一关键词只调用一次 AI

2. **preMatchKeyword（纯文本匹配）**：检查内容文本是否包含任一扩展词
   - 不区分大小写
   - 返回 `{ matched: boolean, matchedTerms: string[] }`

3. **降级策略**：无 API Key 时回退为纯文本拆分（按空格/连字符/下划线分词 + 两两组合）

### 阶段 2：AI Content Analysis（DeepSeek 深度分析）

**模型**: `deepseek-chat`，temperature=0.2（保证判断一致性），max_tokens=500

**System Prompt 核心设计**：

```
角色：热点内容精准匹配专家
输入：关键词 + 内容文本 + 预匹配结果（告知 AI 哪些变体被命中）

六大分析维度：
1. 真实性（isReal）：排除标题党、假新闻、营销软文
2. 相关性（relevance 0-100）：
   - 同领域但未提及关键词 → <40 分
   - 直接讨论/提及/实质关联 → ≥60 分
   - 间接沾边（同类但不同主题） → 30-50 分
3. 关键词提及（keywordMentioned）：是否直接出现关键词或其等价表述
4. 重要程度（importance）：对该关键词关注者而言多重要
   - urgent：突发/重大新闻，行业地震，安全漏洞，必须第一时间知晓
   - high：重要发布/更新，深度分析，名人观点，有实质信息量
   - medium：有参考价值的资讯、讨论、教程、经验分享
   - low：仅简单提及，或价值较低（纯转发、一句话带过、SEO水文）
5. 关联说明（summary）：一句话说清内容与关键词的关系
6. 打分理由（relevanceReason）：一句解释相关性评分的依据

输出：纯 JSON（不用 markdown 包裹），便于程序解析
```

**预匹配结果对 Prompt 的影响**：
- 匹配成功 → 告知 AI "文本已命中这些变体"，AI 可更自信地给高分
- 未匹配 → 告知 AI "未命中任何变体，请特别严格审核"，AI 会更审慎

### 过滤决策树

```
AI 返回 { isReal, relevance, keywordMentioned, importance, summary }
       │
       ├─ isReal = false ──────────→ ❌ 丢弃（虚假/标题党/营销）
       │
       ├─ relevance < 50 ──────────→ ❌ 丢弃（不够相关）
       │
       ├─ !keywordMentioned
       │   └─ relevance < 65 ──────→ ❌ 丢弃（未提及且不够相关）
       │
       └─ 通过 ─────────────────────→ ✅ 入库 + 推送通知
                                       ├─ importance=high/urgent → 邮件通知
                                       └─ 全部 → WebSocket 实时推送
```

### 降级与容错

| 场景 | 行为 |
|---|---|
| 未配置 API Key | relevance=50（匹配）/20（未匹配），importance=low |
| AI 调用异常 | relevance=30（匹配）/10（未匹配），importance=low |
| AI 返回非 JSON | 视为解析失败，走 fallback |
| 单条分析超时 | 不影响其他条，该条走 fallback |
| 批量分析 | 每 3 条一批并行，总配额 25 条/次扫描 |

---

## 六、资讯卡片评分展示体系

前端每条热点卡片展示 5 个维度的 AI 分析结果：

### 1. 重要程度（importance）

**由 DeepSeek AI 直接判断**，Prompt 给出了明确的分级标准：

| 级别 | AI 判断依据 | 标签 | 颜色 |
|---|---|---|---|
| `urgent` | 突发/重大新闻，行业地震级事件，官方重大公告，安全漏洞预警 — **必须第一时间知晓** | urgent | 红色 |
| `high` | 重要产品发布/更新，深度分析/评测，知名人物观点，有实质信息量的内容 | high | 橙色 |
| `medium` | 有一定参考价值的相关资讯、讨论、教程、经验分享 | medium | 琥珀色 |
| `low` | 仅简单提及关键词，或价值较低（纯转发、一句话带过、SEO 水文） | low | 翠绿色 |

> 高重要度（high/urgent）的热点会额外触发邮件通知。

### 2. 真实性（isReal）

**由 DeepSeek AI 直接判断**，识别标题党、假新闻、营销软文：

| 条件 | 标签 | 颜色 | 说明 |
|---|---|---|---|
|---|---|---|---|
| `isReal=true && relevance≥80` | **可信** ✅ | 翠绿 | AI 判定真实 + 高匹配度 |
| `isReal=true && relevance<80` | 无标签 | — | 真实但匹配度一般 |
| `isReal=false` | **可疑** ⚠️ | 红色 | 标题党/假新闻/营销软文 |

### 3. 关键词提及（keywordMentioned）

**由 DeepSeek AI 直接判断**，检测内容中是否出现关键词或其等价表述：

| 值 | 标签 | 颜色 | 含义 |
|---|---|---|---|
| `true` | **直接提及** | 紫色 | 内容中直接出现关键词或其等价表述 |
| `false` | **间接相关** | 黄色 | 同领域但未显式提及关键词 |

### 4. 匹配度（relevance）

**由 DeepSeek AI 直接打分**（0-100），综合内容语义、关键词关联度、信息质量得出：

- 该分数由 DeepSeek 综合内容语义、关键词关联度、信息质量得出
- 低于 50 分的内容已在后端过滤，前端不会展示

### 5. 热度指数（heat score）

**前端计算**，综合多平台互动数据归一化到 0-100：

```
原始分 = 点赞×2 + 转发×3 + 回复×1.5 + 评论×1.5 + 引用×2 + 浏览÷100
热度指数 = min(100, round(log10(原始分 + 1) × 25))
```

**权重设计**：转发 > 引用 ≈ 点赞 > 评论 ≈ 回复 > 浏览

| 分数区间 | 等级 | 颜色 |
|---|---|---|
| ≥80 | **爆** 🔥 | 红色 |
| 60-79 | **热** | 橙色 |
| 40-59 | **温** | 琥珀色 |
| 20-39 | **凉** | 蓝色 |
| <20 | **冷** | 灰色 |

> 对数压缩确保少量高互动内容不会完全淹没其他结果。

---

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

