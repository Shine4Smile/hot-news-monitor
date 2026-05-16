---
name: hot-pulse-monitor
description: |
  HotPulse 热点监控 Skill。当你需要对指定关键词进行全网热点监控、多源信息搜索、或评估某段内容与特定关键词的相关性时，使用此 Skill。
  
  触发场景：
  - "帮我监控 XXX 的最新动态"
  - "搜索一下 XXX 有什么热点"
  - "最近 XXX 有什么新闻"
  - "查一下 XXX 的动向"
  - "XXX 有什么新消息"
  - "这段内容和 XXX 相关吗"
  - "帮我分析这篇文章是否关于 XXX"
  
  此 Skill 包含 Python 搜索脚本（多源采集）和分析指南（给 AI 代理的评分标准）。搜索不需要任何 API Key 或外部服务，分析由安装此 Skill 的 AI 代理自行完成。
---

# HotPulse 热点监控 Skill

## 概述

此 Skill 让你能够对任意关键词进行全网热点监控。它包含两部分：

1. **Python 搜索脚本**：从多个公开信息源并行采集内容
2. **AI 分析指南**：给 AI 代理的评分标准，用于判断内容相关性/真实性/重要程度

你（AI 代理）的职责是：**执行搜索脚本获取原始数据，然后根据分析指南自行判断每条内容的价值。**

## 工作流程

```
用户请求"监控 XXX"
       │
       ▼
Step 1: 运行 Python 搜索脚本
       │  python scripts/search.py --query "XXX"
       │  或启动完整监控：
       │  python scripts/monitor.py --keywords "XXX,YYY" --freshness 168
       │
       ▼
Step 2: 获得结构化搜索结果（JSON）
       │  每条结果包含：title, content, url, source, publishedAt, 互动指标
       │
       ▼
Step 3: 读取 analysis-guide.md 了解评分标准
       │
       ▼
Step 4: 你对每条结果进行 AI 分析：
       │  - 相关性评分（0-100）
       │  - 真实性判断（true/false）
       │  - 重要程度（low/medium/high/urgent）
       │  - 是否直接提及关键词
       │  - 关联说明（一句话）
       │
       ▼
Step 5: 过滤 & 呈现
       │  丢弃虚假/低相关/不相关内容
       │  按重要程度排序展示给用户
       │  标注每条的关键发现和理由
```

## 脚本说明

### `search.py` — 多源关键词搜索

在多个平台搜索指定关键词，返回统一格式的结果。

```bash
# 基础用法
python scripts/search.py --query "DeepSeek"

# 指定来源和数量
python scripts/search.py --query "GPT-5" --sources bing,sogou,bilibili,weibo,hackernews --max 15

# 输出 JSON 到文件
python scripts/search.py --query "AI编程" --output results.json
```

**参数：**

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `--query` | 是 | 搜索关键词 | - |
| `--sources` | 否 | 来源列表，逗号分隔。可选：bing, sogou, bilibili, weibo, hackernews | 全部 |
| `--max` | 否 | 每个来源最大返回数 | 20 |
| `--output` | 否 | 结果输出文件路径 | stdout |

### `monitor.py` — 完整监控流水线

对关键词执行「搜索 → 去重 → 新鲜度过滤 → 输出结构化结果」全流程。

```bash
# 监控单个关键词
python scripts/monitor.py --keywords "DeepSeek"

# 监控多个关键词，设定 3 天内的新鲜度
python scripts/monitor.py --keywords "GPT-5,Claude,AI编程" --freshness 72

# 输出 Markdown 报告格式
python scripts/monitor.py --keywords "Cursor" --format markdown
```

**参数：**

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `--keywords` | 是 | 监控关键词，逗号分隔 | - |
| `--freshness` | 否 | 新鲜度阈值（小时），超过此时间的内容被过滤 | 168（7天） |
| `--max-total` | 否 | 总计最大返回数 | 50 |
| `--format` | 否 | 输出格式：json / table / markdown | json |
| `--output` | 否 | 结果输出文件路径 | stdout |

## 依赖安装

```bash
pip install -r scripts/requirements.txt
```

仅需 `requests` 和 `beautifulsoup4`，无需 API Key，无需数据库。

## AI 分析指南

**在分析搜索结果前，必须先读取 `references/analysis-guide.md`**，其中包含：

- 相关性评分标准（0-100 分的详细梯度）
- 真实性判断规则（如何识别标题党/假新闻/营销软文）
- 重要程度分级（low/medium/high/urgent 的判断依据）
- 关键词提及检测方法
- 输出格式模板

## 数据源说明

详见 `references/source-config.md`，包括各数据源的 URL 格式、解析规则、频率限制和已知限制。

## 错误处理

- **搜索源不可用**：脚本使用并行请求，单个源失败不阻断其他源。结果中会标注失败的源。
- **网络超时**：每个请求 15 秒超时，自动跳过。
- **HTML 解析失败**：返回空结果，打印 warning。
- **环境问题**：如缺少 Python 依赖，先执行 `pip install -r scripts/requirements.txt`。

## 示例对话

**用户**：「帮我监控 DeepSeek 和 GPT-5 的最新动态」

**你的执行步骤**：
1. 先确保依赖已安装（检查或执行 pip install）
2. 运行 `python scripts/monitor.py --keywords "DeepSeek,GPT-5" --freshness 72 --format json`
3. 读取 `references/analysis-guide.md` 理解评分标准
4. 对返回的每条结果用你的 AI 能力进行评分
5. 过滤掉虚假/低相关/无关内容
6. 按重要程度排序，呈现如下：

```markdown
## 🔥 DeepSeek & GPT-5 热点监控报告
*采集时间：2026-05-16 | 来源：Bing, Sogou, Bilibili, Weibo, HN*

### 🚨 紧急
| 来源 | 标题 | 相关性 | 分析 |
|------|------|--------|------|
| Weibo | DeepSeek 发布 V3 重大更新... | 95 | 官方发布，直接相关 |

### 🔥 重要
| 来源 | 标题 | 相关性 | 分析 |
|------|------|--------|------|
| HN | DeepSeek V3 benchmarks analysis | 88 | 技术评测，有价值 |
| Bilibili | GPT-5 内测体验分享 | 82 | 一手体验，有参考价值 |

...
```
