const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Keywords
  getKeywords: () => request<any[]>('/keywords'),
  addKeyword: (keyword: string, category: string) =>
    request<any>('/keywords', {
      method: 'POST',
      body: JSON.stringify({ keyword, category }),
    }),
  deleteKeyword: (id: number) =>
    request<any>(`/keywords/${id}`, { method: 'DELETE' }),

  // Hotspots
  getHotspots: (params?: { category?: string; verified?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.verified) qs.set('verified', params.verified);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<any>(`/hotspots?${qs}`);
  },

  // Notifications
  getNotifications: (page = 1, limit = 50) =>
    request<any>(`/notifications?page=${page}&limit=${limit}`),
  markRead: (id: number) =>
    request<any>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () =>
    request<any>('/notifications/read-all', { method: 'PUT' }),
  getUnreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  // Stats
  getStats: () => request<any>('/stats'),

  // Trigger
  triggerCollect: () => request<any>('/trigger/collect', { method: 'POST' }),
  triggerVerify: () => request<any>('/trigger/verify', { method: 'POST' }),
};
