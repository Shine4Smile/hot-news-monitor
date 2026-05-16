import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Search, Plus, Bell, Trash2,
  ExternalLink, RefreshCw, ShieldAlert, Zap,
  Target, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  keywordsApi, hotspotsApi, notificationsApi, triggerHotspotCheck,
  type Keyword, type Hotspot, type Notification,
} from './services/api';
import { onNewHotspot, onNotification } from './services/socket';
import { cn } from './lib/utils';
import { BackgroundBeams } from './components/BackgroundBeams';
import { sortHotspots } from './utils/sortHotspots';
import { relativeTime } from './utils/relativeTime';

const sourceLabels: Record<string, string> = {
  'IT之家': 'IT之家', '百度热搜': '百度热搜', '微博热搜': '微博热搜',
  'GitHub Trending': 'GitHub', 'Bing 搜索': 'Bing', 'Solidot': 'Solidot',
};

const importanceLabel: Record<string, string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };

function getSourceIcon(source: string) {
  const icons: Record<string, string> = {
    '微博热搜': '🔥', '百度热搜': '🔍', 'IT之家': '📰',
    'GitHub Trending': '⭐', 'Bing 搜索': '🌐', 'Solidot': '📡',
  };
  return icons[source] || '🌐';
}

export default function App() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [newKeyword, setNewKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'keywords'>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Expanded states
  const [expandedReasons, setExpandedReasons] = useState<Set<number>>(new Set());

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 20, page: currentPage, sortBy, sortOrder };
      if (sourceFilter) params.source = sourceFilter;
      if (importanceFilter) params.importance = importanceFilter;
      const res = await hotspotsApi.getAll(params);
      setHotspots(res.data || []);
      setTotalPages(Math.ceil((res.total || 0) / 20));

      const kwData = await keywordsApi.getAll();
      setKeywords(kwData);

      const unreadRes = await notificationsApi.getUnreadCount();
      setUnreadCount(unreadRes.count || 0);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, sourceFilter, importanceFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub1 = onNewHotspot((hotspot) => {
      setHotspots(prev => [hotspot, ...prev.slice(0, 19)]);
      showToast('发现新热点: ' + (hotspot.title || '').slice(0, 30));
      loadData();
    });
    const unsub2 = onNotification(() => loadData());
    return () => { unsub1(); unsub2(); };
  }, [loadData]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await keywordsApi.create(newKeyword.trim(), '通用');
      setNewKeyword('');
      await loadData();
      showToast('关键词已添加');
    } catch (err: any) {
      showToast(err.message || '添加失败', 'error');
    }
  };

  const handleDeleteKeyword = async (id: number) => {
    await keywordsApi.delete(id);
    loadData();
  };

  const handleToggleKeyword = async (kw: Keyword) => {
    await keywordsApi.toggle(kw.id);
    loadData();
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      await triggerHotspotCheck();
      showToast('热点检查已触发');
      setTimeout(loadData, 5000);
    } catch (error) {
      showToast('触发失败', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setUnreadCount(0);
    } catch {}
  };

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.getAll({ limit: 50 });
      setNotifications(res.data || []);
    } catch {}
  };

  useEffect(() => {
    if (showNotifications) loadNotifications();
  }, [showNotifications]);

  const heatLabel = (h: Hotspot) => {
    const score = (h.like_count || 0) * 10 + (h.comment_count || 0) * 5;
    if (score > 1000) return '🔥🔥';
    if (score > 100) return '🔥';
    return '';
  };

  return (
    <div className="min-h-screen bg-[#050510] relative overflow-hidden">
      <BackgroundBeams />

      {/* Toasts */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm shadow-lg",
              toast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Flame className="w-6 h-6 text-cyber-neon" />
              PulseScope
              <span className="text-sm font-normal text-slate-500 ml-2">热点监控</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">实时追踪 · AI 验真 · 即时通知</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-neon/10 border border-cyber-neon/30 text-cyber-neon text-sm hover:bg-cyber-neon/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn("w-4 h-4", isChecking && "animate-spin")} />
              {isChecking ? '检索中...' : '立即检索'}
            </button>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-12 w-80 bg-[#0a0a14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                      <h3 className="font-medium text-white text-sm">通知</h3>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs text-cyber-neon hover:underline cursor-pointer">
                          全部已读
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-8">暂无通知</p>
                      ) : (
                        notifications.slice(0, 10).map(n => (
                          <div key={n.id} className={cn("p-3 text-sm transition-colors border-b border-white/5", n.is_read ? 'opacity-50' : 'hover:bg-white/5')}>
                            <p className="text-white font-medium truncate">{n.title}</p>
                            <p className="text-slate-500 text-xs mt-0.5 truncate">{n.message}</p>
                            <p className="text-slate-600 text-[10px] mt-1">{relativeTime(n.created_at)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 mb-6 border-b border-white/10 pb-0">
          {[
            ['dashboard', '🔥 热点看板'],
            ['keywords', '🎯 关键词管理'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors cursor-pointer relative",
                activeTab === key ? "text-cyber-neon bg-cyber-neon/5" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label}
              {activeTab === key && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-cyber-neon rounded-full" />}
            </button>
          ))}
        </nav>

        <main>
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <>
              {/* Filter + Sort */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 cursor-pointer">
                    <option value="">全部来源</option>
                    {['IT之家','百度热搜','微博热搜','GitHub Trending','Bing 搜索','Solidot'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select value={importanceFilter} onChange={e => { setImportanceFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 cursor-pointer">
                    <option value="">全部重要性</option>
                    <option value="urgent">紧急</option>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600">排序:</span>
                  {[
                    ['created_at','最新'],['hot','最热'],['relevance','相关度'],['importance','重要性']
                  ].map(([k, l]) => (
                    <button key={k}
                      onClick={() => { setSortBy(k); if (k !== sortBy) setSortOrder('desc'); else setSortOrder(o => o === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
                      className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer",
                        sortBy === k ? 'bg-cyber-neon/15 text-cyber-neon' : 'text-slate-600 hover:text-slate-400'
                      )}>
                      {l} {sortBy === k && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hotspot cards */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-cyber-neon/30 border-t-cyber-neon rounded-full animate-spin" />
                </div>
              ) : hotspots.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
                  <Search className="w-8 h-8 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">尚未发现热点</p>
                  <p className="text-sm text-slate-600 mt-1">添加监控关键词开始追踪</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortHotspots(hotspots as any, sortBy, sortOrder).map((h: Hotspot, i: number) => {
                    const heat = heatLabel(h);
                    return (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn("group p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all",
                        h.is_fake ? 'opacity-40' : ''
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {h.importance !== 'low' && (
                              <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-semibold",
                                h.importance === 'urgent' && "bg-red-500/15 text-red-400 border border-red-500/20",
                                h.importance === 'high' && "bg-orange-500/15 text-orange-400 border border-orange-500/20",
                                h.importance === 'medium' && "bg-amber-500/15 text-amber-400 border border-amber-500/20",
                              )}>
                                {importanceLabel[h.importance]}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-600 flex items-center gap-1">
                              {getSourceIcon(h.source)} {sourceLabels[h.source] || h.source}
                            </span>
                            {h.is_fake === 1 && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400">可疑</span>
                            )}
                            {heat && <span className="text-[10px]">{heat}</span>}
                          </div>

                          <h3 className="font-medium text-white mb-2 group-hover:text-cyber-neon transition-colors">{h.title}</h3>
                          {h.ai_summary && (
                            <p className="text-sm text-slate-500 mb-2">{h.ai_summary}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mb-2">
                            <span className="flex items-center gap-1">
                              <Target className="w-3.5 h-3.5" />
                              相关性 {h.ai_score}%
                            </span>
                            {h.like_count > 0 && <span>👍 {h.like_count}</span>}
                            {h.comment_count > 0 && <span>💬 {h.comment_count}</span>}
                            {h.view_count > 0 && <span>👁 {h.view_count}</span>}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-600">
                            {h.published_at && <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{relativeTime(h.published_at)}</span>}
                          </div>

                          {h.relevance_reason && (
                            <div className="mt-2">
                              <button onClick={() => {
                                setExpandedReasons(prev => { const next = new Set(prev); next.has(h.id) ? next.delete(h.id) : next.add(h.id); return next; });
                              }}
                                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyber-neon transition-colors cursor-pointer"
                              >
                                {expandedReasons.has(h.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                AI 分析理由
                              </button>
                              {expandedReasons.has(h.id) && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                                  <p className="text-xs text-slate-500 mt-1 pl-4 border-l-2 border-cyber-neon/20">{h.relevance_reason}</p>
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>

                        {h.source_url && (
                          <a href={h.source_url} target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/5 text-slate-600 hover:text-cyber-neon hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )})}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer">
                    上一页
                  </button>
                  <span className="px-3 py-1.5 text-xs text-slate-500">{currentPage} / {totalPages}</span>
                  <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer">
                    下一页
                  </button>
                </div>
              )}
            </>
          )}

          {/* Keywords Tab */}
          {activeTab === 'keywords' && (
            <div className="max-w-2xl">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="输入关键词，按 Enter 添加..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:border-cyber-neon/50 outline-none"
                />
                <button onClick={handleAddKeyword} disabled={!newKeyword.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyber-neon text-cyber-bg font-medium text-sm hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer">
                  <Plus className="w-4 h-4" /> 添加
                </button>
              </div>

              <div className="space-y-2">
                {keywords.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-8">尚未添加关键词</p>
                )}
                {keywords.map(kw => (
                  <div key={kw.id} className={cn(
                    "flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 group",
                    !kw.active && 'opacity-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleToggleKeyword(kw)}
                        className={cn("w-8 h-4 rounded-full transition-colors cursor-pointer relative",
                          kw.active ? 'bg-emerald-500' : 'bg-slate-700'
                        )}>
                        <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                          kw.active ? 'left-4' : 'left-0.5'
                        )} />
                      </button>
                      <span className={cn("text-sm", kw.active ? 'text-white font-medium' : 'text-slate-500 line-through')}>
                        {kw.keyword}
                      </span>
                      {kw.category && (
                        <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded">{kw.category}</span>
                      )}
                    </div>
                    <button onClick={() => handleDeleteKeyword(kw.id)}
                      className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
