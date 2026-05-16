import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Hotspot } from '../types';

const importanceLabel: Record<string, string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };
const importanceColor: Record<string, string> = {
  urgent: 'text-cyber-warn bg-cyber-warn/10',
  high: 'text-cyber-pulse bg-cyber-pulse/10',
  medium: 'text-cyber-neon bg-cyber-neon/10',
  low: 'text-cyber-muted bg-cyber-surface',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-cyber-ok' : score >= 40 ? 'bg-cyber-warn' : 'bg-cyber-muted';
  return (
    <div className="w-full bg-cyber-surface rounded-full h-1.5 mt-2">
      <div className={`${color} h-1.5 rounded-full transition-all duration-700`}
           style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  );
}

const sortOptions = [
  { key: 'created_at', label: '最新' },
  { key: 'hot', label: '最热' },
  { key: 'relevance', label: '相关度' },
  { key: 'importance', label: '重要性' },
];

export default function HotspotBoard() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [loading, setLoading] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Set<number>>(new Set());

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: 12, sortBy, sortOrder: 'desc' };
      if (filter === 'verified') params.verified = '1';
      else if (filter === 'unverified') params.verified = '0';
      const res = await api.getHotspots(params);
      setHotspots(res.data);
      setTotal(res.total);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filter, sortBy]);

  useEffect(() => { load(page); }, [load, page]);

  const toggleReason = (id: number) => {
    setExpandedReasons(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const heatLabel = (h: Hotspot) => {
    const score = (h.like_count || 0) * 10 + (h.comment_count || 0) * 5;
    if (score > 1000) return { text: '🔥🔥', cls: 'text-cyber-warn' };
    if (score > 100) return { text: '🔥', cls: 'text-cyber-pulse' };
    return { text: '', cls: '' };
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: '', label: '全部' },
            { key: 'verified', label: 'AI 已验证' },
            { key: 'unverified', label: '待验证' },
          ].map((f) => (
            <button key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f.key ? 'bg-cyber-neon text-cyber-bg' : 'bg-cyber-surface text-cyber-muted hover:text-cyber-text'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-cyber-muted">排序:</span>
          {sortOptions.map(s => (
            <button key={s.key}
              onClick={() => { setSortBy(s.key); setPage(1); }}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                sortBy === s.key ? 'bg-cyber-pulse/20 text-cyber-pulse' : 'text-cyber-muted hover:text-cyber-text'
              }`}>
              {s.label}
            </button>
          ))}
          <span className="text-xs text-cyber-muted ml-2">{total} 条</span>
        </div>
      </div>

      {/* Hotspot cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && hotspots.length === 0 && (
          <div className="col-span-2 text-center text-cyber-muted py-12 text-sm">⏳ 加载中...</div>
        )}
        {!loading && hotspots.length === 0 && (
          <div className="col-span-2 text-center text-cyber-muted py-12 text-sm">📭 暂无热点数据</div>
        )}
        {hotspots.map((h) => {
          const heat = heatLabel(h);
          return (
          <div key={h.id}
            className={`glass-card rounded-xl p-4 hover:border-cyber-neon/30 transition-all group relative overflow-hidden ${h.is_fake ? 'opacity-50' : ''}`}>
            {/* Top badges row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] text-cyber-muted bg-cyber-surface px-2 py-0.5 rounded-full">{h.source}</span>
              <span className="text-[10px] text-cyber-muted">{new Date(h.created_at).toLocaleDateString('zh-CN')}</span>
              {h.ai_verified === 1 && h.importance !== 'low' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${importanceColor[h.importance] || ''}`}>
                  {importanceLabel[h.importance] || h.importance}
                </span>
              )}
              {heat.text && <span className={`text-[10px] ${heat.cls}`}>{heat.text}</span>}
              {h.ai_verified === 1 && (
                <span className="text-[10px] text-cyber-ok ml-auto">✓ {h.ai_score}分</span>
              )}
              {h.ai_verified === 0 && (
                <span className="text-[10px] text-cyber-warn ml-auto animate-pulse">待验证</span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold leading-relaxed mb-1.5 group-hover:text-cyber-neon transition-colors">
              {h.title}
            </h3>

            {/* Summary */}
            <p className="text-xs text-cyber-muted leading-relaxed line-clamp-2 mb-2">
              {h.ai_summary || h.summary}
            </p>

            {/* Score bar */}
            {h.ai_verified === 1 && <ScoreBar score={h.ai_score} />}

            {/* Engagement data */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-cyber-muted">
              {h.like_count > 0 && <span>👍 {h.like_count}</span>}
              {h.comment_count > 0 && <span>💬 {h.comment_count}</span>}
              {h.view_count > 0 && <span>👁 {h.view_count}</span>}
              {h.keyword_match && (
                <span className="text-cyber-pulse bg-cyber-pulse/10 px-2 py-0.5 rounded-full">🎯 {h.keyword_match}</span>
              )}
            </div>

            {/* AI Relevance Reason */}
            {h.relevance_reason && (
              <div className="mt-2">
                <button onClick={() => toggleReason(h.id)}
                  className="text-[10px] text-cyber-muted hover:text-cyber-neon transition-colors cursor-pointer">
                  {expandedReasons.has(h.id) ? '收起' : 'AI 分析理由'}
                </button>
                {expandedReasons.has(h.id) && (
                  <p className="text-[10px] text-cyber-muted mt-1 pl-2 border-l-2 border-cyber-neon/30">
                    {h.relevance_reason}
                  </p>
                )}
              </div>
            )}
          </div>
        )})}
      </div>

      {/* Pagination */}
      {total > 12 && (
        <div className="flex justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs bg-cyber-surface text-cyber-muted hover:text-cyber-text disabled:opacity-30 cursor-pointer">← 上一页</button>
          <span className="px-3 py-1.5 text-xs text-cyber-muted">{page} / {Math.ceil(total / 12)}</span>
          <button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs bg-cyber-surface text-cyber-muted hover:text-cyber-text disabled:opacity-30 cursor-pointer">下一页 →</button>
        </div>
      )}
    </div>
  );
}
