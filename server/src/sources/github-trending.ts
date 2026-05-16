import * as cheerio from 'cheerio';
import type { Source, RawHotspot } from './types.js';

/**
 * GitHub Trending — 解析 HTML 页面
 * URL: https://github.com/trending?since=daily
 */
export const githubTrendingSource: Source = {
  name: 'GitHub Trending',
  category: '开源',
  interval: 7200, // 2 hours — daily list
  enabled: true,

  async fetch(_keywords: string[]): Promise<RawHotspot[]> {
    const res = await fetch('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const items: RawHotspot[] = [];

    $('article.Box-row').each((_i, el) => {
      const title = $(el).find('h2 a').text().replace(/\s+/g, ' ').trim();
      const desc = $(el).find('p').text().trim();
      const href = $(el).find('h2 a').attr('href') || '';
      const starsText = $(el).find('.d-inline-block.float-sm-right, .Link--muted').first().text().replace(/,/g, '').trim();
      const stars = parseInt(starsText, 10) || 0;
      if (title) {
        items.push({
          title,
          summary: desc || title,
          sourceUrl: `https://github.com${href}`,
          likeCount: stars,
        });
      }
    });

    return items.slice(0, 15);
  },
};
