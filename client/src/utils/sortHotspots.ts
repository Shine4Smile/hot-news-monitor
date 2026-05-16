export interface SortableHotspot {
  like_count: number | null;
  view_count: number | null;
  comment_count: number | null;
  importance: string;
  ai_score: number;
  published_at: string | null;
  created_at: string;
}

export const IMPORTANCE_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function calcHotScore(item: SortableHotspot): number {
  const likes = item.like_count || 0;
  const views = item.view_count || 0;
  const comments = item.comment_count || 0;
  return likes * 10 + comments * 5 + Math.log10(Math.max(views, 1)) * 2;
}

export function sortHotspots<T extends SortableHotspot>(items: T[], sortBy: string, sortOrder: 'asc' | 'desc' = 'desc'): T[] {
  const sorted = [...items];
  const desc = sortOrder === 'desc';
  sorted.sort((a, b) => {
    let result: number;
    switch (sortBy) {
      case 'hot': result = calcHotScore(a) - calcHotScore(b); break;
      case 'relevance': result = (a.ai_score || 0) - (b.ai_score || 0); break;
      case 'importance': {
        result = (IMPORTANCE_ORDER[a.importance] ?? 4) - (IMPORTANCE_ORDER[b.importance] ?? 4);
        if (result === 0) { result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); return desc ? -result : result; }
        return desc ? result : -result;
      }
      default: result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
    }
    return desc ? -result : result;
  });
  return sorted;
}
