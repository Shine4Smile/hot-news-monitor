import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Keyword } from '../types';

export default function KeywordManager({ onTriggerSearch }: { onTriggerSearch?: () => void }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKw, setNewKw] = useState('');
  const [newCat, setNewCat] = useState('通用');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadKeywords = useCallback(async () => {
    try {
      const data = await api.getKeywords();
      setKeywords(data);
    } catch (err) {
      console.error('Failed to load keywords:', err);
    }
  }, []);

  useEffect(() => { loadKeywords(); }, [loadKeywords]);

  const handleAdd = async () => {
    if (!newKw.trim()) return;
    setLoading(true);
    try {
      await api.addKeyword(newKw.trim(), newCat);
      setNewKw('');
      await loadKeywords();
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleToggle = async (id: number, active: boolean) => {
    await api.toggleKeyword(id, !active);
    loadKeywords();
  };

  const handleDelete = async (id: number) => {
    await api.deleteKeyword(id);
    loadKeywords();
  };

  const handleTriggerSearch = async () => {
    setSearching(true);
    try {
      await api.triggerCollect();
      onTriggerSearch?.();
    } catch (err: any) {
      alert(err.message);
    }
    setSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="space-y-4">
      {/* Input area */}
      <div className="glass-card rounded-xl p-4 glow-neon">
        <label className="text-xs text-cyber-muted uppercase tracking-wider mb-2 block">
          添加监控关键词
        </label>
        <div className="flex gap-2">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text focus:border-cyber-neon outline-none cursor-pointer"
          >
            <option value="通用">通用</option>
            <option value="AI大模型">AI大模型</option>
            <option value="AI编程">AI编程</option>
            <option value="前端技术">前端技术</option>
            <option value="时政新闻">时政新闻</option>
            <option value="科技">科技</option>
          </select>
          <input
            type="text"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入关键词，按 Enter 添加..."
            className="flex-1 bg-cyber-surface border border-cyber-border rounded-lg px-4 py-2 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-neon outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newKw.trim()}
            className="px-5 py-2 bg-cyber-neon text-cyber-bg rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
          >
            {loading ? '...' : '追踪'}
          </button>
        </div>
        {/* Trigger search button */}
        <button
          onClick={handleTriggerSearch}
          disabled={searching}
          className="mt-3 w-full px-4 py-2 border border-cyber-neon/40 text-cyber-neon rounded-lg text-sm font-medium hover:bg-cyber-neon/10 disabled:opacity-40 transition-all cursor-pointer"
        >
          {searching ? '⏳ 检索中...' : '🔍 立即检索一次'}
        </button>
      </div>

      {/* Keywords list */}
      <div className="space-y-2">
        {keywords.length === 0 && (
          <p className="text-cyber-muted text-sm text-center py-8">
            尚未添加关键词，在上方输入你关注的关键词开始监控
          </p>
        )}
        {keywords.map((kw) => (
          <div
            key={kw.id}
            className={`glass-card rounded-lg px-4 py-3 flex items-center justify-between group hover:border-cyber-pulse/40 transition-all ${!kw.active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              {/* Toggle switch */}
              <button
                onClick={() => handleToggle(kw.id, !!kw.active)}
                className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                  kw.active ? 'bg-cyber-ok' : 'bg-cyber-muted'
                }`}
                title={kw.active ? '点击停用' : '点击启用'}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    kw.active ? 'left-4' : 'left-0.5'
                  }`}
                />
              </button>
              <span className={`text-sm ${kw.active ? 'font-medium' : 'line-through text-cyber-muted'}`}>
                {kw.keyword}
              </span>
              <span className="text-xs text-cyber-muted bg-cyber-surface px-2 py-0.5 rounded">
                {kw.category}
              </span>
            </div>
            <button
              onClick={() => handleDelete(kw.id)}
              className="text-cyber-muted hover:text-cyber-warn opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
