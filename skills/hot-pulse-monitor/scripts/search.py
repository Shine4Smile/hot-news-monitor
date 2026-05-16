"""
HotPulse 多源关键词搜索脚本

从 Bing / Sogou / Bilibili / Weibo / HackerNews 并行搜索指定关键词，
返回统一格式的搜索结果 JSON。

零配置，零 API Key，纯 HTTP + HTML 解析。

用法：
  python search.py --query "DeepSeek"
  python search.py --query "GPT-5" --sources bing,sogou,weibo --max 15
  python search.py --query "AI编程" --output results.json
"""

import argparse
import json
import sys
import time
import random
import hashlib
import concurrent.futures
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

# ============================================================
# 配置
# ============================================================

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

REQUEST_TIMEOUT = 15  # 秒
BING_RATE_LIMIT = 5    # 秒
SOGOU_RATE_LIMIT = 3
BILIBILI_RATE_LIMIT = 2
WEIBO_RATE_LIMIT = 3
HN_RATE_LIMIT = 1

# ============================================================
# 频率限制器
# ============================================================

class RateLimiter:
    def __init__(self, min_interval: float = 5.0):
        self._last = 0.0
        self._interval = min_interval

    def wait(self):
        elapsed = time.time() - self._last
        if elapsed < self._interval:
            time.sleep(self._interval - elapsed)
        self._last = time.time()


_bing_limiter = RateLimiter(BING_RATE_LIMIT)
_sogou_limiter = RateLimiter(SOGOU_RATE_LIMIT)
_bilibili_limiter = RateLimiter(BILIBILI_RATE_LIMIT)
_weibo_limiter = RateLimiter(WEIBO_RATE_LIMIT)
_hn_limiter = RateLimiter(HN_RATE_LIMIT)


def _random_ua() -> str:
    return random.choice(USER_AGENTS)


# ============================================================
# 类型定义
# ============================================================

def make_result(
    title: str,
    content: str,
    url: str,
    source: str,
    *,
    source_id: Optional[str] = None,
    published_at: Optional[str] = None,
    view_count: Optional[int] = None,
    like_count: Optional[int] = None,
    retweet_count: Optional[int] = None,
    reply_count: Optional[int] = None,
    comment_count: Optional[int] = None,
    quote_count: Optional[int] = None,
    danmaku_count: Optional[int] = None,
    score: Optional[int] = None,
    author_name: Optional[str] = None,
    author_username: Optional[str] = None,
    author_avatar: Optional[str] = None,
    author_followers: Optional[int] = None,
    author_verified: Optional[bool] = None,
) -> dict:
    """构建统一的搜索结果字典。"""
    result = {
        "title": title.strip(),
        "content": content.strip() if content else title.strip(),
        "url": url,
        "source": source,
    }
    if source_id:
        result["sourceId"] = source_id
    if published_at:
        result["publishedAt"] = published_at
    if view_count is not None:
        result["viewCount"] = view_count
    if like_count is not None:
        result["likeCount"] = like_count
    if retweet_count is not None:
        result["retweetCount"] = retweet_count
    if reply_count is not None:
        result["replyCount"] = reply_count
    if comment_count is not None:
        result["commentCount"] = comment_count
    if quote_count is not None:
        result["quoteCount"] = quote_count
    if danmaku_count is not None:
        result["danmakuCount"] = danmaku_count
    if score is not None:
        result["score"] = score

    # 作者信息
    author = {}
    if author_name:
        author["name"] = author_name
    if author_username:
        author["username"] = author_username
    if author_avatar:
        author["avatar"] = author_avatar
    if author_followers is not None:
        author["followers"] = author_followers
    if author_verified is not None:
        author["verified"] = author_verified
    if author:
        result["author"] = author

    return result


# ============================================================
# Bing 搜索
# ============================================================

def search_bing(query: str, max_results: int = 20) -> list[dict]:
    """通过 HTML 解析 Bing 搜索结果。"""
    _bing_limiter.wait()

    results = []
    try:
        resp = requests.get(
            "https://www.bing.com/search",
            params={"q": query, "count": max_results},
            headers={
                "User-Agent": _random_ua(),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        for li in soup.select("li.b_algo"):
            title_el = li.select_one("h2 a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            url = title_el.get("href", "")
            if not url or not url.startswith("http"):
                continue

            snippet_el = li.select_one(".b_caption p")
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            results.append(make_result(title, snippet, url, "bing"))

        print(f"[Bing] query='{query}' → {len(results)} results", file=sys.stderr)

    except requests.RequestException as e:
        print(f"[Bing] query='{query}' → ERROR: {e}", file=sys.stderr)

    return results[:max_results]


# ============================================================
# 搜狗搜索
# ============================================================

def search_sogou(query: str, max_results: int = 20) -> list[dict]:
    """通过 HTML 解析搜狗搜索结果。"""
    _sogou_limiter.wait()

    results = []
    try:
        resp = requests.get(
            "https://www.sogou.com/web",
            params={"query": query, "ie": "utf-8"},
            headers={
                "User-Agent": _random_ua(),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        for el in soup.select(".vrwrap, .rb"):
            title_el = el.select_one("h3 a, .vr-title a, .vrTitle a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            url = title_el.get("href", "")
            if not url:
                continue
            # 搜狗链接可能是相对路径
            if url.startswith("/link?url="):
                url = f"https://www.sogou.com{url}"

            # 跳过"大家还在搜"
            if "大家还在搜" in title:
                continue

            snippet_el = el.select_one(".space-txt, .str-text-info, .str_info, .text-layout")
            if not snippet_el:
                snippet_el = el.select_one("p")
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            results.append(make_result(title, snippet, url, "sogou"))

        print(f"[Sogou] query='{query}' → {len(results)} results", file=sys.stderr)

    except requests.RequestException as e:
        print(f"[Sogou] query='{query}' → ERROR: {e}", file=sys.stderr)

    return results[:max_results]


# ============================================================
# Bilibili 搜索
# ============================================================

def search_bilibili(query: str, max_results: int = 20) -> list[dict]:
    """通过 B站公开搜索 API 获取视频结果。"""
    _bilibili_limiter.wait()

    results = []
    try:
        resp = requests.get(
            "https://api.bilibili.com/x/web-interface/search/type",
            params={
                "search_type": "video",
                "keyword": query,
                "page": 1,
            },
            headers={
                "User-Agent": _random_ua(),
                "Referer": "https://www.bilibili.com/",
                "Accept": "application/json",
            },
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 0:
            print(f"[Bilibili] API error: {data.get('message', 'unknown')}", file=sys.stderr)
            return []

        for item in data.get("data", {}).get("result", [])[:max_results]:
            title = item.get("title", "").replace('<em class="keyword">', "").replace("</em>", "")
            description = item.get("description", "")
            bvid = item.get("bvid", "")
            url = f"https://www.bilibili.com/video/{bvid}" if bvid else item.get("arcurl", "")

            pub_ts = item.get("pubdate")
            published_at = datetime.fromtimestamp(pub_ts, tz=timezone.utc).isoformat() if pub_ts else None

            results.append(make_result(
                title=title,
                content=description,
                url=url,
                source="bilibili",
                source_id=bvid,
                published_at=published_at,
                view_count=item.get("play"),
                like_count=item.get("favorites"),
                comment_count=item.get("review"),
                danmaku_count=item.get("video_review"),
                author_name=item.get("author"),
                author_avatar=item.get("pic", "").startswith("http") and item.get("pic") or None,
            ))

        print(f"[Bilibili] query='{query}' → {len(results)} results", file=sys.stderr)

    except requests.RequestException as e:
        print(f"[Bilibili] query='{query}' → ERROR: {e}", file=sys.stderr)

    return results


# ============================================================
# 微博热搜
# ============================================================

def search_weibo(query: str, max_results: int = 20) -> list[dict]:
    """
    微博搜索。
    优先尝试热搜 API（无需登录），其次尝试网页搜索。
    """
    _weibo_limiter.wait()

    results = []
    try:
        # 使用微博公开的搜索页面
        resp = requests.get(
            "https://s.weibo.com/weibo",
            params={"q": query, "typeall": 1, "suball": 1, "timescope": "custom:7days"},
            headers={
                "User-Agent": _random_ua(),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": "https://s.weibo.com/",
            },
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        for card in soup.select(".card-wrap"):
            title_el = card.select_one(".txt")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)

            link_el = card.select_one("a[href*='weibo.com']")
            url = link_el.get("href", "") if link_el else ""
            if not url:
                continue

            # 提取内容片段
            content_el = card.select_one(".txt")
            content = content_el.get_text(strip=True) if content_el else title

            # 尝试提取时间
            time_el = card.select_one(".from a")
            published_at = None
            if time_el:
                time_text = time_el.get_text(strip=True)
                # 微博时间格式：xx分钟前 / 今天xx:xx / xx月xx日
                published_at = time_text  # 原始时间文本

            results.append(make_result(
                title=title[:200],
                content=content[:500],
                url=url,
                source="weibo",
                published_at=published_at,
            ))

        print(f"[Weibo] query='{query}' → {len(results)} results", file=sys.stderr)

    except requests.RequestException as e:
        print(f"[Weibo] query='{query}' → ERROR: {e}", file=sys.stderr)

    return results[:max_results]


# ============================================================
# Hacker News 搜索 (Algolia API)
# ============================================================

def search_hackernews(query: str, max_results: int = 20) -> list[dict]:
    """通过 HN Algolia 搜索 API 获取结果。"""
    _hn_limiter.wait()

    results = []
    try:
        resp = requests.get(
            "https://hn.algolia.com/api/v1/search",
            params={"query": query, "hitsPerPage": max_results, "tags": "story"},
            headers={"User-Agent": _random_ua()},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        for hit in data.get("hits", [])[:max_results]:
            obj_id = hit.get("objectID", "")
            title = hit.get("title", "")
            url = hit.get("url") or f"https://news.ycombinator.com/item?id={obj_id}"

            created = hit.get("created_at")
            if created:
                try:
                    published_at = datetime.fromisoformat(created.replace("Z", "+00:00")).isoformat()
                except ValueError:
                    published_at = created
            else:
                published_at = None

            results.append(make_result(
                title=title,
                content=hit.get("story_text", "") or title,
                url=url,
                source="hackernews",
                source_id=obj_id,
                published_at=published_at,
                score=hit.get("points"),
                comment_count=hit.get("num_comments"),
                author_name=hit.get("author"),
            ))

        print(f"[HackerNews] query='{query}' → {len(results)} results", file=sys.stderr)

    except requests.RequestException as e:
        print(f"[HackerNews] query='{query}' → ERROR: {e}", file=sys.stderr)

    return results


# ============================================================
# 去重工具
# ============================================================

def deduplicate_results(results: list[dict]) -> list[dict]:
    """基于 (url, source) 组合去重。"""
    seen = set()
    unique = []
    for r in results:
        key = (r["url"], r["source"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


# ============================================================
# 搜索源注册表
# ============================================================

SOURCES = {
    "bing": search_bing,
    "sogou": search_sogou,
    "bilibili": search_bilibili,
    "weibo": search_weibo,
    "hackernews": search_hackernews,
}


# ============================================================
# 主入口：并行搜索
# ============================================================

def search_multiple_sources(
    query: str,
    sources: Optional[list[str]] = None,
    max_results: int = 20,
) -> dict:
    """
    并行从多个来源搜索关键词。

    Args:
        query: 搜索关键词
        sources: 要使用的来源列表，None 表示全部
        max_results: 每个来源的最大结果数

    Returns:
        {
            "query": str,
            "totalResults": int,
            "results": [...],
            "sources": {"bing": count, ...},
            "errors": [str, ...]
        }
    """
    source_names = sources or list(SOURCES.keys())
    source_names = [s for s in source_names if s in SOURCES]

    if not source_names:
        return {"query": query, "totalResults": 0, "results": [], "sources": {}, "errors": ["No valid sources"]}

    all_results = []
    source_counts = {}
    errors = []

    # 并行执行所有搜索源
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(source_names)) as executor:
        futures = {
            executor.submit(SOURCES[name], query, max_results): name
            for name in source_names
        }
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            try:
                results = future.result()
                source_counts[name] = len(results)
                all_results.extend(results)
            except Exception as e:
                errors.append(f"{name}: {e}")
                source_counts[name] = 0
                print(f"[{name}] Future error: {e}", file=sys.stderr)

    # 去重
    unique = deduplicate_results(all_results)

    return {
        "query": query,
        "totalResults": len(unique),
        "results": unique,
        "sources": source_counts,
        "errors": errors,
    }


# ============================================================
# CLI 入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="HotPulse 多源关键词搜索",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python search.py --query "DeepSeek"
  python search.py --query "GPT-5" --sources bing,weibo,hackernews
  python search.py --query "AI编程" --max 10 --output results.json
        """,
    )
    parser.add_argument("--query", "-q", required=True, help="搜索关键词")
    parser.add_argument(
        "--sources", "-s",
        default="bing,sogou,bilibili,weibo,hackernews",
        help="来源列表，逗号分隔。可选: bing, sogou, bilibili, weibo, hackernews"
    )
    parser.add_argument("--max", "-m", type=int, default=20, help="每个来源最大返回数（默认 20）")
    parser.add_argument("--output", "-o", help="输出 JSON 文件路径，不指定则输出到 stdout")

    args = parser.parse_args()

    sources = [s.strip() for s in args.sources.split(",") if s.strip()]

    output = search_multiple_sources(
        query=args.query,
        sources=sources,
        max_results=args.max,
    )

    json_str = json.dumps(output, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(json_str)
        print(f"Results written to {args.output}", file=sys.stderr)
    else:
        print(json_str)


if __name__ == "__main__":
    main()
