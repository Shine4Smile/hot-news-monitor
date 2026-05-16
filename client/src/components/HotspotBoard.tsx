import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Hotspot } from '../types';

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-cyber-ok' : score >= 40 ? 'bg-cyber-warn' : 'bg-cyber-muted';
  return (
    <div className="w-full bg-cyber-surface rounded-full h-1.5 mt-2">
      <div className={`${color} h-1.5 rounded-full transition-all duration-700`}
           style={{ width: `${score}%` }} />
    </div>
  );
}

export default function HotspotBoard() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: 12 };
      if (filter === 'verified') params.verified = '1';
      else if (filter === 'unverified') params.verified = '0';
      const res = await api.getHotspots(params);
      setHotspots(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(page); }, [load, page]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { key: '', label: '全部' },
            { key: 'verified', label: 'AI 已验证' },
            { key: 'unverified', label: '待验证' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f.key
                  ? 'bg-cyber-neon text-cyber-bg'
                  : 'bg-cyber-surface text-cyber-muted hover:text-cyber-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-cyber-muted">{total} 条热点</span>
      </div>

      {/* Hotspot cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && hotspots.length === 0 && (
          <div className="col-span-2 text-center text-cyber-muted py-12 text-sm">
            ⏳ 加载中...
          </div>
        )}
        {!loading && hotspots.length === 0 && (
          <div className="col-span-2 text-center text-cyber-muted py-12 text-sm">
            📭 暂无热点数据
          </div>
        )}
        {hotspots.map((h) => (
          <div
            key={h.id}
            className={`glass-card rounded-xl p-4 hover:border-cyber-neon/30 transition-all group relative overflow-hidden ${
              h.is_fake ? 'opacity-50' : ''
            }`}
          >
            {/* Fake badge */}
            {h.is_fake === 1 && (
              <span className="absolute top-2 right-2 text-[10px] bg-cyber-warn/20 text-cyber-warn px-2 py-0.5 rounded-full">
                AI 判定虚假
              </span>
            )}

            {/* Source & time */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-cyber-muted bg-cyber-surface px-2 py-0.5 rounded-full">
                {h.source}
              </span>
              <span className="text-[10px] text-cyber-muted">
                {new Date(h.created_at).toLocaleDateString('zh-CN')}
              </span>
              {h.ai_verified === 1 && (
                <span className="text-[10px] text-cyber-ok ml-auto">✓ AI验证</span>
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
            <p className="text-xs text-cyber-muted leading-relaxed line-clamp-2">
              {h.ai_summary || h.summary}
            </p>

            {/* AI Score */}
            {h.ai_verified === 1 && <ScoreBar score={h.ai_score} />}

            {/* Keyword match */}
            {h.keyword_match && (
              <div className="mt-2 text-[10px] text-cyber-pulse bg-cyber-pulse/10 px-2 py-0.5 rounded-full inline-block">
                🎯 {h.keyword_match}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > 12 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs bg-cyber-surface text-cyber-muted hover:text-cyber-text disabled:opacity-30 cursor-pointer"
          >
            ← 上一页
          </button>
          <span className="px-3 py-1.5 text-xs text-cyber-muted">
            {page} / {Math.ceil(total / 12)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 12)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs bg-cyber-surface text-cyber-muted hover:text-cyber-text disabled:opacity-30 cursor-pointer"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
