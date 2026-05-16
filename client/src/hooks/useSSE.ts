import { useEffect, useRef, useCallback } from 'react';

type EventHandler = (data: any) => void;

export function useSSE(onHotspot?: EventHandler, onNotification?: EventHandler) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef({ onHotspot, onNotification });
  handlersRef.current = { onHotspot, onNotification };

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;
    const es = new EventSource('/api/stream');
    eventSourceRef.current = es;

    es.addEventListener('new-hotspot', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onHotspot?.(data);
      } catch {}
    });

    es.addEventListener('collect-done', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onNotification?.(data);
      } catch {}
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setTimeout(connect, 5000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);

  return eventSourceRef;
}
