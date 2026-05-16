import { useState, useEffect, useCallback } from 'react';
import ParticleBackground from './components/ParticleBackground';
import KeywordManager from './components/KeywordManager';
import HotspotBoard from './components/HotspotBoard';
import NotificationCenter from './components/NotificationCenter';
import { api } from './hooks/useApi';
import { useSSE } from './hooks/useSSE';
import type { Stats } from './types';

type Tab = 'keywords' | 'hotspots' | 'notifications';

export default function App() {
  const [tab, setTab] = useState<Tab>('hotspots');
  const [stats, setStats] = useState<Stats | null>(null);
  const [notifKey, setNotifKey] = useState(0);

  const loadStats = useCallback(async () => {
    try { const s = await api.getStats(); setStats(s); } catch {}
  }, []);

  useEffect(() => { loadStats(); const id = setInterval(loadStats, 15000); return () => clearInterval(id); }, [loadStats]);

  useSSE(
    () => { loadStats(); setNotifKey((k) => k + 1); },
    () => loadStats()
  );

  const tabStyle = (t: Tab) =>
    `relative px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
      tab === t
        ? 'text-cyber-neon tab-active'
        : 'text-cyber-muted hover:text-cyber-text'
    }`;

  return (
    <div className="relative min-h-screen bg-cyber-bg bg-cyber-grid">
      <ParticleBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <span className="text-cyber-neon">◈</span>
              <span className="bg-gradient-to-r from-cyber-neon to-cyber-pulse bg-clip-text text-transparent">PulseScope</span>
              <span className="text-xs text-cyber-muted font-normal tracking-widest uppercase">热点监控</span>
            </h1>
            <p className="text-xs text-cyber-muted mt-1">实时追踪 · AI 验真 · 即时通知</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-ok opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-ok" />
              </span>
              <span className="text-cyber-muted">监控中</span>
            </div>
            <div className="px-3 py-1.5 glass-card rounded-lg">
              <span className="text-cyber-text font-bold">{stats?.keywords.active ?? 0}</span>
              <span className="text-cyber-muted ml-1">关键词</span>
            </div>
            <div className="px-3 py-1.5 glass-card rounded-lg">
              <span className="text-cyber-text font-bold">{stats?.hotspots.total ?? 0}</span>
              <span className="text-cyber-muted ml-1">热点</span>
            </div>
            <div className="px-3 py-1.5 glass-card rounded-lg">
              <span className="text-cyber-warn font-bold">{stats?.notifications.unread ?? 0}</span>
              <span className="text-cyber-muted ml-1">未读</span>
            </div>
            <div className={`px-3 py-1.5 glass-card rounded-lg ${stats?.aiConnected ? 'text-cyber-ok' : 'text-cyber-muted'}`}>
              {stats?.aiConnected ? '🤖 AI 在线' : '🤖 AI 离线'}
            </div>
          </div>
        </header>
        <nav className="flex gap-1 border-b border-cyber-border/50 mb-6">
          {([['hotspots','🔥 热点看板'],['keywords','🎯 关键词管理'],['notifications','🔔 通知中心']] as [Tab,string][]).map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} className={tabStyle(key)}>
              {label}
              {key === 'notifications' && (stats?.notifications.unread ?? 0) > 0 && (
                <span className="ml-1.5 text-[10px] bg-cyber-warn text-cyber-bg px-1.5 py-0.5 rounded-full font-bold">{stats?.notifications.unread}</span>
              )}
            </button>
          ))}
        </nav>
        <main className="min-h-[400px]">
          {tab === 'keywords' && <KeywordManager />}
          {tab === 'hotspots' && <HotspotBoard />}
          {tab === 'notifications' && <NotificationCenter key={notifKey} />}
        </main>
        <footer className="mt-12 pt-6 border-t border-cyber-border/30 text-center text-[10px] text-cyber-muted">
          PulseScope v1.0 · Powered by DeepSeek AI · Real-time Hot News Monitor
        </footer>
      </div>
    </div>
  );
}
