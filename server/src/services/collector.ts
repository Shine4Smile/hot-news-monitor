import db from '../db.js';
import { collectFromAllSources as collectFromRegistry } from '../sources/registry.js';
import type { CollectedHotspot } from '../sources/types.js';
import { expandKeyword } from '../lib/query-expansion.js';

export type { CollectedHotspot } from '../sources/types.js';

/** Get active keywords from DB */
function getActiveKeywords(): string[] {
  const rows = db.prepare('SELECT keyword FROM keywords WHERE active = 1').all() as { keyword: string }[];
  return rows.map((r) => r.keyword);
}

/**
 * Collect from all enabled sources. 
 * Each keyword is expanded into search variants (query expansion),
 * then the full set is passed to all sources for searching.
 */
export async function collectFromAllSources(): Promise<CollectedHotspot[]> {
  const rawKeywords = getActiveKeywords();
  if (rawKeywords.length === 0) return [];

  // Expand each keyword into search variants
  const expandedSet = new Set<string>();
  console.log(`🔑 Expanding ${rawKeywords.length} keyword(s)...`);
  for (const kw of rawKeywords) {
    expandedSet.add(kw);
    const variants = await expandKeyword(kw);
    for (const v of variants) {
      expandedSet.add(v);
    }
  }
  const allKeywords = [...expandedSet];
  console.log(`   ${rawKeywords.length} keywords → ${allKeywords.length} search terms`);

  return collectFromRegistry(allKeywords);
}

/**
 * Search for content matching a specific keyword across sources.
 * This triggers a fresh collection and filters results.
 */
export async function searchByKeyword(keyword: string): Promise<CollectedHotspot[]> {
  const all = await collectFromAllSources();
  const lowerKw = keyword.toLowerCase();

  return all.filter(
    (h) =>
      h.title.toLowerCase().includes(lowerKw) ||
      h.summary.toLowerCase().includes(lowerKw)
  );
}

/**
 * Save collected hotspots to DB, avoiding duplicates.
 */
export function saveHotspots(hotspots: CollectedHotspot[], keywordMatch = ''): number[] {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO hotspots (title, summary, source, source_url, keyword_match, category, view_count, like_count, comment_count, published_at)
    VALUES (@title, @summary, @source, @sourceUrl, @keywordMatch, @category, @viewCount, @likeCount, @commentCount, COALESCE(@publishedAt, datetime('now')))
  `);

  const ids: number[] = [];

  const insertMany = db.transaction(() => {
    for (const h of hotspots) {
      const result = insert.run({
        title: h.title,
        summary: h.summary,
        source: h.source,
        sourceUrl: h.sourceUrl,
        keywordMatch,
        category: h.category,
        viewCount: h.viewCount || 0,
        likeCount: h.likeCount || 0,
        commentCount: h.commentCount || 0,
        publishedAt: h.publishedAt || null,
      });
      if (result.changes > 0) {
        ids.push(Number(result.lastInsertRowid));
      }
    }
  });

  insertMany();
  return ids;
}
