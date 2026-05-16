/**
 * 热点热度计算与排序工具
 */

export interface SortableHotspot {
  likeCount: number | null;
  viewCount: number | null;
  commentCount: number | null;
  ai_score: number;
  importance: string;
  created_at: string;
  published_at: string | null;
}

export const IMPORTANCE_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** 综合热度分：点赞权重最高，浏览量为辅 */
export function calcHotScore(item: SortableHotspot): number {
  const likes = item.likeCount || 0;
  const views = item.viewCount || 0;
  const comments = item.commentCount || 0;
  return likes * 10 + comments * 5 + Math.log10(Math.max(views, 1)) * 2;
}

export function sortHotspots<T extends SortableHotspot>(
  items: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): T[] {
  const sorted = [...items];
  const desc = sortOrder === 'desc';

  sorted.sort((a, b) => {
    let result: number;

    switch (sortBy) {
      case 'hot':
        result = calcHotScore(a) - calcHotScore(b);
        break;
      case 'relevance':
        result = (a.ai_score || 0) - (b.ai_score || 0);
        break;
      case 'importance':
        result = (IMPORTANCE_ORDER[a.importance] ?? 4) - (IMPORTANCE_ORDER[b.importance] ?? 4);
        if (result === 0) {
          result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          return desc ? -result : result;
        }
        return desc ? result : -result;
      case 'publishedAt':
      default:
        result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }

    return desc ? -result : result;
  });

  return sorted;
}
