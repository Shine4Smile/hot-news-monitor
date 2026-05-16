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
  score: number;
  isRelevant: boolean;
  summary: string;
  keywordMentioned: boolean;
  importance: 'low' | 'medium' | 'high' | 'urgent';
  relevanceReason: string;
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
    return { score: 50, isRelevant: true, summary: '无关键词，默认通过', keywordMentioned: false, importance: 'low', relevanceReason: '' };
  }

  const kwChars = lowerKw.replace(/\s+/g, '').split('');
  const kwWords = lowerKw.split(/\s+/).filter(Boolean);

  // keywordMentioned: exact keyword appeared in title or content
  const keywordMentioned = lowerTitle.includes(lowerKw) || lowerContent.includes(lowerKw);

  // Title match
  let titleScore = 0;
  if (lowerTitle.includes(lowerKw)) {
    titleScore = 100;
  } else {
    const matchedChars = kwChars.filter((ch) => lowerTitle.includes(ch));
    const charRatio = matchedChars.length / kwChars.length;
    const matchedWords = kwWords.filter((w) => lowerTitle.includes(w));
    const wordRatio = kwWords.length > 0 ? matchedWords.length / kwWords.length : 0;
    titleScore = Math.round(Math.max(charRatio * 80, wordRatio * 100));
  }

  // Content match
  let contentScore = 0;
  if (lowerContent) {
    let occurrences = 0;
    let idx = 0;
    while ((idx = lowerContent.indexOf(lowerKw, idx)) !== -1) { occurrences++; idx += lowerKw.length; }
    if (occurrences >= 3) contentScore = 100;
    else if (occurrences === 2) contentScore = 70;
    else if (occurrences === 1) contentScore = 40;
    else {
      const matchedChars = kwChars.filter((ch) => lowerContent.includes(ch));
      contentScore = Math.round((matchedChars.length / kwChars.length) * 30);
    }
  }

  // Quality
  let qualityScore = 100;
  const titleClean = lowerTitle.replace(lowerKw, '').trim();
  if (titleClean.length < 3) qualityScore -= 30;
  const exclamCount = (title.match(/[！!]{2,}/g) || []).length;
  qualityScore -= exclamCount * 15;
  const questionCount = (title.match(/[？?]{2,}/g) || []).length;
  qualityScore -= questionCount * 15;
  if (content && content.length > 100) qualityScore = Math.min(100, qualityScore + 10);
  if (content && content.length > 300) qualityScore = Math.min(100, qualityScore + 10);
  if (title === title.toUpperCase() && title.length > 10) qualityScore -= 20;
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const finalScore = Math.round(titleScore * 0.6 + contentScore * 0.3 + qualityScore * 0.1);

  // Importance from score
  const importance: RelevanceScore['importance'] =
    finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low';

  return {
    score: finalScore,
    isRelevant: finalScore >= 30,
    summary: finalScore >= 60
      ? `标题匹配${titleScore}%、内容匹配${contentScore}%、质量${qualityScore}% → 相关`
      : finalScore >= 30
        ? `标题匹配${titleScore}%、内容匹配${contentScore}% → 待确认`
        : `低相关度(${finalScore}分)`,
    keywordMentioned,
    importance,
    relevanceReason: keywordMentioned
      ? `文中直接提及了关键词"${keyword}"，相关度${finalScore}分`
      : `未直接提及"${keyword}"，匹配度较低(${finalScore}分)`,
  };
}
