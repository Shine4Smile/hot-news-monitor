"""
HotPulse 完整监控流水线

对关键词执行「搜索 → 去重 → 新鲜度过滤 → 结构化输出」全流程。

本脚本不包含 AI 分析——AI 分析由安装此 Skill 的 AI 代理自行完成。
请参阅 references/analysis-guide.md 了解评分标准。

用法：
  python monitor.py --keywords "DeepSeek"
  python monitor.py --keywords "GPT-5,Claude,AI编程" --freshness 72
  python monitor.py --keywords "Cursor" --format markdown --output report.md
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional

from search import search_multiple_sources, deduplicate_results


# ============================================================
# 新鲜度过滤
# ============================================================

def parse_iso_utc(s: Optional[str]) -> Optional[datetime]:
    """尝试解析 ISO 8601 时间字符串。"""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def filter_by_freshness(results: list[dict], max_age_hours: int) -> list[dict]:
    """丢弃超过 max_age_hours 小时的内容。没有发布时间的保留。"""
    if max_age_hours <= 0:
        return results

    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    filtered = []
    for item in results:
        pub = parse_iso_utc(item.get("publishedAt"))
        if pub is None:
            # 没有时间的保留（搜索引擎结果通常无时间）
            filtered.append(item)
        elif pub >= cutoff:
            filtered.append(item)
    return filtered


# ============================================================
# 来源优先级排序
# ============================================================

SOURCE_PRIORITY = {
    "weibo": 1,
    "bilibili": 2,
    "hackernews": 3,
    "sogou": 4,
    "bing": 5,
}


def sort_by_priority(results: list[dict]) -> list[dict]:
    """按来源优先级 + 发布时间排序。"""
    def sort_key(item: dict):
        priority = SOURCE_PRIORITY.get(item.get("source", ""), 99)
        pub = parse_iso_utc(item.get("publishedAt"))
        # 有时间的优先（更新的在前），没时间的排后面
        ts = pub.timestamp() if pub else 0
        return (priority, -ts)

    return sorted(results, sort_key)


# ============================================================
# 统计汇总
# ============================================================

def summarize_results(results: list[dict]) -> dict:
    """对结果集合进行统计汇总。"""
    sources = {}
    for r in results:
        src = r.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1

    with_time = sum(1 for r in results if r.get("publishedAt"))
    with_author = sum(1 for r in results if r.get("author"))

    return {
        "total": len(results),
        "bySource": sources,
        "withPublishedTime": with_time,
        "withAuthor": with_author,
    }


# ============================================================
# 输出格式化
# ============================================================

def format_as_table(results: list[dict]) -> str:
    """以人类可读的表格输出。"""
    lines = []
    lines.append(f"{'#':>3} {'来源':<12} {'标题':<60} {'时间':<10}")
    lines.append("-" * 90)
    for i, r in enumerate(results, 1):
        src = r.get("source", "?")[:12]
        title = r.get("title", "")[:57] + ("..." if len(r.get("title", "")) > 60 else "")
        pub = r.get("publishedAt", "")[:10]
        lines.append(f"{i:>3} {src:<12} {title:<60} {pub:<10}")
    return "\n".join(lines)


def format_as_markdown(results: list[dict], stats: dict) -> str:
    """生成 Markdown 热点监控报告。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        f"## 🔍 热点监控报告",
        f"*采集时间：{now} | 发现 {stats['total']} 条结果*",
        "",
        "### 📊 来源分布",
    ]
    for src, count in sorted(stats.get("bySource", {}).items(), key=lambda x: -x[1]):
        lines.append(f"- **{src}**: {count} 条")
    lines.append("")

    if not results:
        lines.append("*未发现相关内容*")
        return "\n".join(lines)

    lines.append("### 📋 搜索结果")
    lines.append("")
    lines.append("| # | 来源 | 标题 | 时间 |")
    lines.append("|---|------|------|------|")
    for i, r in enumerate(results, 1):
        src = r.get("source", "?")
        title = r.get("title", "").replace("|", "\\|")[:80]
        url = r.get("url", "")
        pub = (r.get("publishedAt") or "")[:10]
        title_link = f"[{title}]({url})" if url else title
        lines.append(f"| {i} | {src} | {title_link} | {pub} |")

    lines.append("")
    lines.append("---")
    lines.append("*报告由 HotPulse Agent Skill 生成。请 AI 代理根据 analysis-guide.md 对以上结果进行相关性/真实性/重要程度分析。*")

    return "\n".join(lines)


# ============================================================
# 主入口：完整监控流水线
# ============================================================

def run_monitor(
    keywords: list[str],
    freshness_hours: int = 168,  # 默认 7 天
    max_total: int = 50,
    sources: Optional[list[str]] = None,
    format: str = "json",
) -> str:
    """
    执行完整监控流水线。

    Args:
        keywords: 监控关键词列表
        freshness_hours: 新鲜度阈值（小时），超过此时间的内容被丢弃
        max_total: 总计返回的最大结果数
        sources: 要搜索的来源，None 表示全部
        format: 输出格式 — "json", "table", "markdown"

    Returns:
        格式化后的结果字符串
    """
    all_results = []
    errors_by_keyword = {}

    for kw in keywords:
        print(f"\n{'='*50}", file=sys.stderr)
        print(f"📎 监控关键词: \"{kw}\"", file=sys.stderr)
        print(f"{'='*50}", file=sys.stderr)

        output = search_multiple_sources(query=kw, sources=sources, max_results=20)

        all_results.extend(output["results"])

        if output["errors"]:
            errors_by_keyword[kw] = output["errors"]

        for src, count in output["sources"].items():
            print(f"  {src}: {count} results", file=sys.stderr)

    # 全局去重
    unique = deduplicate_results(all_results)
    print(f"\n  总计: {len(all_results)} 条原始 → {len(unique)} 条去重后", file=sys.stderr)

    # 新鲜度过滤
    fresh = filter_by_freshness(unique, freshness_hours)
    dropped = len(unique) - len(fresh)
    if dropped > 0:
        print(f"  新鲜度过滤: 丢弃 {dropped} 条（> {freshness_hours}h）", file=sys.stderr)

    # 按优先级排序
    sorted_results = sort_by_priority(fresh)

    # 截断
    final = sorted_results[:max_total]
    if len(sorted_results) > max_total:
        print(f"  截断: {len(sorted_results)} → {len(final)}（超过 max-total={max_total}）", file=sys.stderr)

    # 统计
    stats = summarize_results(final)

    # 输出
    if format == "table":
        output_str = format_as_table(final)
    elif format == "markdown":
        output_str = format_as_markdown(final, stats)
    else:
        output_str = json.dumps({
            "keywords": keywords,
            "stats": stats,
            "results": final,
            "errors": errors_by_keyword if errors_by_keyword else None,
        }, ensure_ascii=False, indent=2)

    return output_str


# ============================================================
# CLI 入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="HotPulse 完整热点监控流水线",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python monitor.py --keywords "DeepSeek"
  python monitor.py --keywords "GPT-5,Claude,AI编程" --freshness 72
  python monitor.py --keywords "Cursor" --format markdown --output report.md
        """,
    )
    parser.add_argument(
        "--keywords", "-k", required=True,
        help="监控关键词，逗号分隔"
    )
    parser.add_argument(
        "--freshness", "-f", type=int, default=168,
        help="新鲜度阈值（小时），默认 168（7天）"
    )
    parser.add_argument(
        "--max-total", "-m", type=int, default=50,
        help="总计最大返回数（默认 50）"
    )
    parser.add_argument(
        "--sources", "-s",
        default="bing,sogou,bilibili,weibo,hackernews",
        help="来源列表，逗号分隔"
    )
    parser.add_argument(
        "--format", "-fmt",
        choices=["json", "table", "markdown"],
        default="json",
        help="输出格式（默认 json）"
    )
    parser.add_argument("--output", "-o", help="输出文件路径，不指定则输出到 stdout")

    args = parser.parse_args()

    keywords = [k.strip() for k in args.keywords.split(",") if k.strip()]
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]

    output_str = run_monitor(
        keywords=keywords,
        freshness_hours=args.freshness,
        max_total=args.max_total,
        sources=sources,
        format=args.format,
    )

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_str)
        print(f"\nResults written to {args.output}", file=sys.stderr)
    else:
        print(output_str)


if __name__ == "__main__":
    main()
