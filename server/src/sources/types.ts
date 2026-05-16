/** Raw hotspot returned by a source before processing */
export interface RawHotspot {
  title: string;
  summary: string;
  sourceUrl: string;
  publishedAt?: string;
}

/** External hotspot after collection, ready for DB */
export interface CollectedHotspot {
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  category: string;
}

/** Source module interface */
export interface Source {
  name: string;
  category: string;
  /** Base interval between fetches in seconds */
  interval: number;
  enabled: boolean;
  /** Fetch hotspots for given keywords */
  fetch(keywords: string[]): Promise<RawHotspot[]>;
}

/**
 * Pre-filter: remove low-quality items before DB insertion.
 * Returns only items that pass quality checks.
 */
export function preFilterHotspots(items: RawHotspot[]): RawHotspot[] {
  return items.filter((item) => {
    const title = (item.title || '').trim();
    const summary = (item.summary || '').trim();

    // Rule 1: Title too short
    if (title.length < 6) return false;

    // Rule 2: Summary too short (if exists, must be meaningful)
    if (summary.length > 0 && summary.length < 10) return false;

    // Rule 3: Title is a URL
    if (/^https?:\/\//i.test(title)) return false;

    // Rule 4: Title is mostly numbers/symbols (not natural language)
    const meaningfulChars = title.replace(/[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ffa-zA-Z0-9]/g, '').length;
    if (meaningfulChars / Math.max(title.length, 1) < 0.3) return false;

    // Rule 5: Title equals summary and both are very short (< 15 chars)
    if (title === summary && title.length < 15) return false;

    // Rule 6: Summary that's just whitespace/punctuation
    if (summary.length > 0 && summary.replace(/[\s.,;:!?，。；：！？…]+/g, '').length < 3) return false;

    return true;
  });
}
