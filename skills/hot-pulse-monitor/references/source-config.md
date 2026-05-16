# 数据源配置参考

## 概览

| # | 数据源 | 类型 | 访问方式 | 是否需要 Key | 语言 |
|---|--------|------|----------|-------------|------|
| 1 | **Bing** | 搜索引擎 | HTML 解析 | ❌ | 中/英 |
| 2 | **搜狗 (Sogou)** | 搜索引擎 | HTML 解析 | ❌ | 中文 |
| 3 | **Bilibili** | 视频平台 | 公开搜索 API | ❌ | 中文 |
| 4 | **微博 (Weibo)** | 社交平台 | HTML 解析 | ❌ | 中文 |
| 5 | **Hacker News** | 技术社区 | Algolia API | ❌ | 英文 |

---

## 1. Bing

- **URL**: `https://www.bing.com/search?q={query}&count=20`
- **返回**: 搜索结果页 HTML，通过 CSS 选择器 `li.b_algo` 解析标题/链接/摘要
- **频率限制**: 建议 ≥ 5 秒间隔
- **已知限制**:
  - 部分结果可能是广告
  - 搜索结果通常没有发布时间
  - 反爬措施较宽松，但高频可能触发验证码
  - 中文搜索效果不如百度，但比百度反爬更友好

## 2. 搜狗 (Sogou)

- **URL**: `https://www.sogou.com/web?query={query}&ie=utf-8`
- **返回**: 搜索结果页 HTML，通过 CSS 选择器 `.vrwrap, .rb` 解析
- **频率限制**: 建议 ≥ 3 秒间隔
- **已知限制**:
  - 搜索结果链接可能是相对路径（`/link?url=...`），需要转绝对路径
  - 部分结果包含「大家还在搜」推荐，需过滤
  - 搜索结果通常没有发布时间
  - 中文搜索效果较好

## 3. Bilibili

- **URL**: `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={query}`
- **返回**: JSON，包含视频标题、描述、播放量、弹幕数、UP主信息
- **频率限制**: 建议 ≥ 2 秒间隔
- **已知限制**:
  - 部分标题包含 `<em class="keyword">` 高亮标记，需要去除
  - 返回结果可能包含大量无关下载工具/盗版内容（搜索软件名时）
  - 仅返回视频内容，不含专栏/动态
  - 有反爬措施，过于频繁可能返回空结果

## 4. 微博 (Weibo)

- **URL**: `https://s.weibo.com/weibo?q={query}&typeall=1&suball=1&timescope=custom:7days`
- **返回**: 搜索结果页 HTML，通过 CSS 选择器 `.card-wrap` 解析
- **频率限制**: 建议 ≥ 3 秒间隔
- **已知限制**:
  - 微博反爬严格，可能需要多次尝试
  - 不登录时搜索范围受限
  - 时间信息以「xx分钟前」「今天xx:xx」等相对格式呈现
  - 部分微博链接可能需要登录才能查看完整内容
  - 搜索结果质量波动较大

## 5. Hacker News

- **URL**: `https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage=20`
- **返回**: JSON，包含标题、URL、评分(point)、评论数、作者、发布时间
- **频率限制**: 建议 ≥ 1 秒间隔
- **已知限制**:
  - 仅返回英文技术内容
  - 搜索索引更新可能有几分钟延迟
  - 结果中的 `url` 可能是 HN 内部链接（如果原帖是 Ask HN 等）
  - Algolia API 可能有速率限制（官方文档建议 10,000 次/小时）

---

## 通用注意事项

### 反爬策略

所有 HTML 解析源（Bing、Sogou、Weibo）都有反爬措施。脚本内置了：
- **随机 User-Agent** 轮换
- **请求间隔控制**（频率限制器）
- **超时处理**（15 秒超时自动跳过）

如果某个源持续返回空结果，可能是触发了反爬，建议：
- 增加请求间隔
- 减少单次搜索量
- 暂时跳过该源

### 稳定性

各源的可用性会随时间变化。建议按以下顺序排列可靠性：
1. Hacker News（Algolia API，最稳定）
2. Bilibili（公开 API，较稳定）
3. Bing（HTML 解析，中等稳定）
4. Sogou（HTML 解析，中等稳定）
5. Weibo（HTML 解析，较不稳定）

### 结果质量

不同来源的内容特点：
- **Bing/Sogou**: 全面但噪声大，需要 AI 仔细过滤
- **Bilibili**: 视频标题/描述，互动数据丰富，适合评估热度
- **Weibo**: 实时性强，适合突发新闻，但内容质量参差不齐
- **HackerNews**: 技术质量高，但仅限英文技术圈

---

## 添加新数据源

如需添加新数据源，在 `search.py` 中：
1. 实现 `search_xxx(query, max_results)` 函数
2. 返回格式符合 `make_result()` 的输出
3. 在 `SOURCES` 字典中注册
4. 使用频率限制器控制请求频率
