/**
 * 前端 API 服务层 — 适配后端 REST API
 */
const BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Types ----
export interface Keyword {
  id: number;
  keyword: string;
  category: string;
  active: number;
  created_at: string;
}

export interface Hotspot {
  id: number;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  keyword_match: string;
  category: string;
  ai_verified: number;
  ai_score: number;
  ai_summary: string;
  is_fake: number;
  keyword_mentioned: number;
  importance: string;
  relevance_reason: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string;
  created_at: string;
  keyword?: { id: number; text: string; category: string } | null;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  hotspot_id: number;
  is_read: number;
  created_at: string;
}

export interface Stats {
  total: number;
  today: number;
  urgent: number;
  bySource: Record<string, number>;
}

// ---- Keywords API ----
export const keywordsApi = {
  getAll: () => request<Keyword[]>('/keywords'),
  create: (keyword: string, category: string) =>
    request<Keyword>('/keywords', { method: 'POST', body: JSON.stringify({ keyword, category }) }),
  delete: (id: number) =>
    request<void>(`/keywords/${id}`, { method: 'DELETE' }),
  toggle: (id: number) =>
    request<Keyword>(`/keywords/${id}`, { method: 'PUT', body: JSON.stringify({ active: 0 }) }),
};

// ---- Hotspots API ----
export const hotspotsApi = {
  getAll: (params?: {
    page?: number; limit?: number; source?: string; importance?: string;
    sortBy?: string; sortOrder?: string; verified?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.append(k, String(v)); });
    return request<{ data: Hotspot[]; total: number; page: number; limit: number }>(`/hotspots?${sp}`);
  },
  getStats: () => request<Stats>('/stats/hotspots'),
  delete: (id: number) => request<void>(`/hotspots/${id}`, { method: 'DELETE' }),
};

// ---- Notifications API ----
export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.append(k, String(v)); });
    return request<{ data: Notification[]; total: number }>(`/notifications?${sp}`);
  },
  markAsRead: (id: number) =>
    request<void>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () =>
    request<void>('/notifications/read-all', { method: 'PUT' }),
  getUnreadCount: () =>
    request<{ count: number }>('/notifications/unread-count'),
  delete: (id: number) => request<void>(`/notifications/${id}`, { method: 'DELETE' }),
};

// ---- Trigger ----
export const triggerHotspotCheck = () =>
  request<{ message: string }>('/trigger/collect', { method: 'POST' });
