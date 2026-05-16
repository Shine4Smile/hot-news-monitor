import type { Source, CollectedHotspot } from './types.js';
import { preFilterHotspots } from './types.js';
import { ithomeSource } from './ithome.js';
import { baiduHotSource } from './baidu-hot.js';
import { weiboHotSource } from './weibo.js';
import { githubTrendingSource } from './github-trending.js';
import { bingSource } from './bing-search.js';
import { solidotSource } from './solidot.js';

/** All registered sources */
const ALL_SOURCES: Source[] = [
  ithomeSource,
  baiduHotSource,
  weiboHotSource,
  githubTrendingSource,
  bingSource,
  solidotSource,
];

/** Track last fetch time per source to respect interval */
const lastFetchTimes = new Map<string, number>();

/** Get all enabled sources */
export function getEnabledSources(): Source[] {
  return ALL_SOURCES.filter((s) => s.enabled);
}

/** Check if a source is ready for its next fetch (based on interval) */
export function isSourceReady(source: Source): boolean {
  const lastFetch = lastFetchTimes.get(source.name) || 0;
  return Date.now() - lastFetch >= source.interval * 1000;
}

/** Mark a source as just fetched */
export function markSourceFetched(source: Source): void {
  lastFetchTimes.set(source.name, Date.now());
}

/** Add random jitter (±30%) to interval to avoid detectable patterns */
function applyJitter(baseIntervalMs: number): number {
  const jitter = (Math.random() - 0.5) * 0.6; // ±30%
  return Math.round(baseIntervalMs * (1 + jitter));
}

/**
 * Keyword-driven collection: for each active keyword, search ALL enabled sources.
 * Results are pre-filtered before returning.
 *
 * @param keywords - active keyword strings; if empty, returns early
 */
export async function collectFromAllSources(keywords: string[]): Promise<CollectedHotspot[]> {
  if (keywords.length === 0) {
    console.log('⏭  No active keywords — skipping all collection');
    return [];
  }

  const sources = getEnabledSources();
  if (sources.length === 0) {
    console.log('⏭  No enabled sources');
    return [];
  }

  const allHotspots: CollectedHotspot[] = [];

  console.log(`🎯 Collecting for ${keywords.length} keyword(s) across ${sources.length} source(s)...`);

  // For each keyword, search ALL sources
  for (let ki = 0; ki < keywords.length; ki++) {
    const kw = keywords[ki];
    console.log(`  🔑 " ${kw} " (${ki + 1}/${keywords.length})`);

    for (let si = 0; si < sources.length; si++) {
      const source = sources[si];

      // Check if source is ready (with jitter)
      const lastFetch = lastFetchTimes.get(source.name) || 0;
      const baseIntervalMs = source.interval * 1000;
      const effectiveInterval = applyJitter(baseIntervalMs);
      const elapsed = Date.now() - lastFetch;

      if (elapsed < effectiveInterval) {
        const remaining = Math.round((effectiveInterval - elapsed) / 1000);
        if (ki === 0) {
          console.log(`     ⏭  ${source.name} not ready (${remaining}s remaining)`);
        }
        continue;
      }

      try {
        const rawItems = await source.fetch(keywords);
        // Pre-filter: remove low-quality items
        const validItems = preFilterHotspots(rawItems);
        const dropped = rawItems.length - validItems.length;

        markSourceFetched(source);

        for (const item of validItems) {
          allHotspots.push({
            title: item.title,
            summary: item.summary,
            source: source.name,
            sourceUrl: item.sourceUrl,
            category: source.category,
          });
        }

        const dropInfo = dropped > 0 ? ` (filtered ${dropped})` : '';
        console.log(`     ✅ ${source.name}: ${validItems.length} items${dropInfo}`);
      } catch (err: any) {
        console.error(`     ❌ ${source.name}:`, err.message);
        // Don't update last fetch time on failure
      }

      // Delay between sources to be respectful
      if (si < sources.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  console.log(`📰 Total: ${allHotspots.length} hotspots (for ${keywords.length} keywords, ${sources.length} sources)`);
  return allHotspots;
}

/**
 * Get source by name (for testing)
 */
export function getSourceByName(name: string): Source | undefined {
  return ALL_SOURCES.find((s) => s.name === name);
}
