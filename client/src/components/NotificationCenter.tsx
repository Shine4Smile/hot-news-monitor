import { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi';
import type { Notification } from '../types';

export default function NotificationCenter({
  onNewNotif,
}: {
  onNewNotif?: () => void;
}) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications(1, 100);
      setNotifs(res.data);
      const { count } = await api.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Expose load for parent refresh
  useEffect(() => {
    if (onNewNotif) {
      const id = setInterval(load, 15000);
      return () => clearInterval(id);
    }
  }, [onNewNotif, load]);

  const handleMarkRead = async (id: number) => {
    await api.markRead(id);
    load();
  };

  const handleMarkAll = async () => {
    await api.markAllRead();
    load();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">通知中心</span>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-cyber-warn text-cyber-bg px-2 py-0.5 rounded-full font-bold animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="text-xs text-cyber-neon hover:underline cursor-pointer"
          >
            全部已读
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
        {notifs.length === 0 && (
          <p className="text-cyber-muted text-sm text-center py-12">
            🔔 暂无通知
          </p>
        )}
        {notifs.map((n) => (
          <div
            key={n.id}
            onClick={() => handleMarkRead(n.id)}
            className={`glass-card rounded-lg px-4 py-3 cursor-pointer transition-all hover:border-cyber-neon/30 ${
              n.is_read ? 'opacity-60' : 'border-l-2 border-l-cyber-neon'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">
                {n.type === 'hotspot' ? '🔥' : '📡'}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-relaxed ${n.is_read ? 'text-cyber-muted' : 'text-cyber-text font-medium'}`}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="text-[11px] text-cyber-muted mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                )}
                <p className="text-[10px] text-cyber-muted mt-1">
                  {new Date(n.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
              {!n.is_read && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-neon flex-shrink-0 mt-1.5" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
