import * as cheerio from 'cheerio';
import type { Source, RawHotspot } from './types.js';

/**
 * Bing Search — 基于关键词搜索，解析搜索结果页
 * 仅当有关键词时才执行搜索
 */
export const bingSource: Source = {
  name: 'Bing 搜索',
  category: '搜索',
  interval: 1800, // 30 min
  enabled: true,

  async fetch(keywords: string[]): Promise<RawHotspot[]> {
    if (!keywords || keywords.length === 0) return [];

    const allItems: RawHotspot[] = [];
    const seen = new Set<string>();

    // Search each keyword (max 3 to avoid too many requests)
    for (const kw of keywords.slice(0, 3)) {
      try {
        const query = encodeURIComponent(kw);
        const res = await fetch(
          `https://www.bing.com/search?q=${query}&filters=tnTID%3a%22News%22`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept-Language': 'zh-CN,zh;q=0.9',
              Accept: 'text/html',
            },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);

        // Bing search results: .b_algo h2 a for title, .b_caption p for snippet
        $('.b_algo').each((_i, el) => {
          const $el = $(el);
          const title = $el.find('h2 a').text().trim();
          const snippet = $el.find('.b_caption p, .b_caption').text().trim();
          const url = $el.find('h2 a').attr('href') || '';
          if (title && title.length > 5 && !seen.has(title)) {
            seen.add(title);
            allItems.push({
              title,
              summary: snippet.slice(0, 300) || title,
              sourceUrl: url,
            });
          }
        });

        // Small delay between keyword searches
        if (keywords.indexOf(kw) < Math.min(keywords.length, 3) - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`Bing search for "${kw}" failed:`, (err as Error).message);
      }
    }

    return allItems.slice(0, 30);
  },
};
