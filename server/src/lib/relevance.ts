/**
 * Keyword Relevance Scoring — used as fallback when DeepSeek AI is unavailable.
 *
 * Scoring weights:
 *   - Title match: 60%
 *   - Content match: 30%
 *   - Quality score: 10%
 *
 * Thresholds:
 *   ≥ 60 → relevant
 *   30-59 → uncertain
 *   < 30 → not relevant
 */

export interface RelevanceScore {
  score: number;        // 0-100
  isRelevant: boolean;  // >= 60
  summary: string;      // brief explanation
}

export function calculateRelevance(
  title: string,
  content: string,
  keyword: string
): RelevanceScore {
  const lowerTitle = title.toLowerCase();
  const lowerContent = (content || '').toLowerCase();
  const lowerKw = keyword.toLowerCase().trim();

  if (!lowerKw) {
    return { score: 50, isRelevant: true, summary: '无关键词，默认通过' };
  }

  // Split keyword into individual characters and words
  const kwChars = lowerKw.replace(/\s+/g, '').split('');
  const kwWords = lowerKw.split(/\s+/).filter(Boolean);

  // ---- 1. Title match score (0-100) ----
  let titleScore = 0;
  if (lowerTitle.includes(lowerKw)) {
    titleScore = 100; // exact phrase match
  } else {
    // Check character-level match in title
    const matchedChars = kwChars.filter((ch) => lowerTitle.includes(ch));
    const charRatio = matchedChars.length / kwChars.length;
    // Check word-level match
    const matchedWords = kwWords.filter((w) => lowerTitle.includes(w));
    const wordRatio = kwWords.length > 0 ? matchedWords.length / kwWords.length : 0;
    titleScore = Math.round(Math.max(charRatio * 80, wordRatio * 100));
  }

  // ---- 2. Content match score (0-100) ----
  let contentScore = 0;
  if (lowerContent) {
    // Count keyword occurrences
    let occurrences = 0;
    let idx = 0;
    while ((idx = lowerContent.indexOf(lowerKw, idx)) !== -1) {
      occurrences++;
      idx += lowerKw.length;
    }
    if (occurrences >= 3) contentScore = 100;
    else if (occurrences === 2) contentScore = 70;
    else if (occurrences === 1) contentScore = 40;
    else {
      // Check partial match
      const matchedChars = kwChars.filter((ch) => lowerContent.includes(ch));
      contentScore = Math.round((matchedChars.length / kwChars.length) * 30);
    }
  } else {
    contentScore = 0;
  }

  // ---- 3. Quality / anti-clickbait score (0-100) ----
  let qualityScore = 100;

  // Penalize very short titles (< 5 chars after removing keyword)
  const titleClean = lowerTitle.replace(lowerKw, '').trim();
  if (titleClean.length < 3) qualityScore -= 30;

  // Penalize excessive punctuation (??? !!! etc)
  const exclamCount = (title.match(/[！!]{2,}/g) || []).length;
  const questionCount = (title.match(/[？?]{2,}/g) || []).length;
  qualityScore -= exclamCount * 15;
  qualityScore -= questionCount * 15;

  // Bonus for substantial content length
  if (content && content.length > 100) qualityScore = Math.min(100, qualityScore + 10);
  if (content && content.length > 300) qualityScore = Math.min(100, qualityScore + 10);

  // Penalize ALL CAPS titles
  if (title === title.toUpperCase() && title.length > 10) qualityScore -= 20;

  // Clamp
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // ---- Final score ----
  const finalScore = Math.round(titleScore * 0.6 + contentScore * 0.3 + qualityScore * 0.1);

  return {
    score: finalScore,
    isRelevant: finalScore >= 30,
    summary:
      finalScore >= 60
        ? `标题匹配${titleScore}%、内容匹配${contentScore}%、质量${qualityScore}% → 相关`
        : finalScore >= 30
          ? `标题匹配${titleScore}%、内容匹配${contentScore}% → 待确认`
          : `低相关度(${finalScore}分)`,
  };
}
