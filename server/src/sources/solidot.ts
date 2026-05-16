import type { Source, RawHotspot } from './types.js';

/**
 * Solidot — 老牌科技新闻站，提供 RSS 2.0
 * URL: https://www.solidot.org/
 *
 * RSS feed: http://www.solidot.org/index.rss
 */
export const solidotSource: Source = {
  name: 'Solidot',
  category: '科技',
  interval: 3600, // 60 min
  enabled: true,

  async fetch(_keywords: string[]): Promise<RawHotspot[]> {
    // Try RSS first
    let res: Response;
    try {
      res = await fetch('https://www.solidot.org/index.rss', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PulseScope/1.0)',
          Accept: 'application/rss+xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      return []; // Silently skip if unreachable
    }

    if (!res.ok) return [];
    const xml = await res.text();

    const items: RawHotspot[] = [];
    const seen = new Set<string>();
    
    // Parse RSS items with CDATA
    const itemBlockRegex = /<item>([\s\S]*?)<\/item>/gi;
    let blockMatch: RegExpExecArray | null;
    
    while ((blockMatch = itemBlockRegex.exec(xml)) !== null && items.length < 25) {
      const block = blockMatch[1];
      
      // Extract title
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      // Extract description (CDATA or raw)
      const descMatch = block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is);
      // Extract link
      const linkMatch = block.match(/<link>\s*(.*?)\s*<\/link>/i);
      
      const title = titleMatch?.[1]?.trim() || '';
      if (!title || title.length < 2 || seen.has(title)) continue;
      seen.add(title);
      
      const rawDesc = descMatch?.[1]?.trim() || '';
      const desc = rawDesc.replace(/<[^>]+>/g, '').trim().slice(0, 200);
      const url = linkMatch?.[1]?.trim() || '';
      
      items.push({ title, summary: desc || title, sourceUrl: url });
    }

    return items;
  },
};
