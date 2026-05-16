export interface Keyword {
  id: number;
  keyword: string;
  category: string;
  active: number;
  created_at: string;
  updated_at: string;
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
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  hotspot_id: number | null;
  hotspot_title?: string;
  is_read: number;
  created_at: string;
}

export interface Stats {
  keywords: { total: number; active: number };
  hotspots: { total: number; verified: number; fake: number };
  notifications: { total: number; unread: number };
  sseClients: number;
  aiConnected: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
