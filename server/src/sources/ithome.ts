import * as cheerio from 'cheerio';
import type { Source, RawHotspot } from './types.js';

/**
 * IT之家 — 科技资讯，解析 HTML
 * URL: https://www.ithome.com/
 */
export const ithomeSource: Source = {
  name: 'IT之家',
  category: '科技',
  interval: 900, // 15 min
  enabled: true,

  async fetch(_keywords: string[]): Promise<RawHotspot[]> {
    const res = await fetch('https://www.ithome.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`IT之家 returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const items: RawHotspot[] = [];
    const seen = new Set<string>();

    // IT之家 article links are in <li> and have URL pattern /0/XXX/XXX.htm
    $('li a[href]').each((_i, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const title = $a.text().trim();
      // Only article links (not navigation/sidebar)
      if (href.includes('/0/') && title.length > 8 && title.length < 200 && !seen.has(href)) {
        seen.add(href);
        const fullUrl = href.startsWith('http') ? href : `https://www.ithome.com${href}`;
        // Try to get description from sibling or parent text
        const parentText = $a.parent().text().trim();
        const desc = parentText.length > title.length + 5 ? parentText.replace(title, '').trim() : title;
        items.push({ title, summary: desc.substring(0, 300), sourceUrl: fullUrl });
      }
    });

    // Also catch any <a> with article pattern outside <li>
    if (items.length < 5) {
      $('a[href]').each((_i, el) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const title = $a.text().trim();
        if (href.includes('/0/') && title.length > 8 && title.length < 200 && !seen.has(href)) {
          seen.add(href);
          const fullUrl = href.startsWith('http') ? href : `https://www.ithome.com${href}`;
          items.push({ title, summary: title, sourceUrl: fullUrl });
        }
      });
    }

    return items.slice(0, 20);
  },
};
