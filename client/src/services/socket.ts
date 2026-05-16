/**
 * SSE 事件监听（替代 WebSocket）
 * 适配前端需要的 onNewHotspot / onNotification 接口
 */

type Callback = (data: any) => void;

let es: EventSource | null = null;
const hotspotCallbacks: Callback[] = [];
const notifCallbacks: Callback[] = [];

function ensureConnection() {
  if (es && es.readyState === EventSource.OPEN) return;
  es = new EventSource('/api/stream');
  es.addEventListener('new-hotspot', (e) => {
    try {
      const data = JSON.parse(e.data);
      hotspotCallbacks.forEach((cb) => cb(data));
    } catch {}
  });
  es.addEventListener('collect-done', (e) => {
    try {
      const data = JSON.parse(e.data);
      notifCallbacks.forEach((cb) => cb(data));
    } catch {}
  });
  es.onerror = () => {
    es?.close();
    es = null;
    setTimeout(ensureConnection, 5000);
  };
}

export function onNewHotspot(cb: Callback) {
  hotspotCallbacks.push(cb);
  ensureConnection();
  return () => {
    const idx = hotspotCallbacks.indexOf(cb);
    if (idx >= 0) hotspotCallbacks.splice(idx, 1);
  };
}

export function onNotification(cb: Callback) {
  notifCallbacks.push(cb);
  ensureConnection();
  return () => {
    const idx = notifCallbacks.indexOf(cb);
    if (idx >= 0) notifCallbacks.splice(idx, 1);
  };
}

/** No-op — SSE doesn't support keyword-based rooms */
export function subscribeToKeywords(_keywords: string[]) {}
