import type { Source, RawHotspot } from './types.js';

/**
 * 微博热搜 — 公开 JSON API
 * URL: https://weibo.com/ajax/side/hotSearch
 */
export const weiboHotSource: Source = {
  name: '微博热搜',
  category: '综合',
  interval: 1200, // 20 min
  enabled: true,

  async fetch(_keywords: string[]): Promise<RawHotspot[]> {
    const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://weibo.com/',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Weibo returned ${res.status}`);
    const json = (await res.json()) as any;
    const data = json?.data?.realtime || json?.data || [];

    return data.slice(0, 20).map((item: any) => ({
      title: item.word || item.note || '',
      summary: item.note || `热度: ${item.num || item.raw_hot || 0}`,
      sourceUrl: item.word_scheme
        ? `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word)}`
        : `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
    }));
  },
};
