import * as cheerio from 'cheerio';
import type { Source, RawHotspot } from './types.js';

/**
 * 百度热搜 — 解析 HTML
 * URL: https://top.baidu.com/board?tab=realtime
 */
export const baiduHotSource: Source = {
  name: '百度热搜',
  category: '综合',
  interval: 1200, // 20 min
  enabled: true,

  async fetch(_keywords: string[]): Promise<RawHotspot[]> {
    const res = await fetch('https://top.baidu.com/board?tab=realtime', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Baidu returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const items: RawHotspot[] = [];

    // Baidu hot list uses .category-wrap_iQLoo items
    $('.category-wrap_iQLoo .content_1YWBm, [class*=content], [class*=item-wrap]').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('.c-single-text-ellipsis, .title_dIF3B, [class*=title]').first();
      const descEl = $el.find('.hot-desc_1m_jR, .desc_E0zIb, [class*=desc]').first();
      const title = titleEl.text().trim();
      const desc = descEl.text().trim();
      if (title && title.length > 1) {
        items.push({
          title,
          summary: desc || title,
          sourceUrl: `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`,
        });
      }
    });

    // Fallback: look for any text that looks like a hot topic
    if (items.length === 0) {
      // Try to parse the embedded data
      const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.+?\});/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const cards = data?.cards || [];
          for (const card of cards) {
            const content = card?.content || [];
            for (const c of content) {
              if (c.word && !items.find(i => i.title === c.word)) {
                items.push({
                  title: c.word,
                  summary: c.desc || c.word,
                  sourceUrl: `https://www.baidu.com/s?wd=${encodeURIComponent(c.word)}`,
                });
              }
            }
          }
        } catch {}
      }
    }

    return items.slice(0, 20);
  },
};
