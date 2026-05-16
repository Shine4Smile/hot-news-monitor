/**
 * 关键词预匹配
 * 
 * 在调用 AI 之前，先用扩展关键词集合快速扫描文本内容，
 * 判断文本是否可能包含目标信息。作为 AI 验证的前置过滤。
 */

export interface PreMatchResult {
  /** 是否匹配到至少一个扩展关键词 */
  matched: boolean;
  /** 匹配到的关键词列表 */
  matchedTerms: string[];
  /** 匹配到的最高优先级词（最长的匹配） */
  bestMatch: string;
}

/**
 * 检查文本中是否包含任一扩展关键词（大小写不敏感）。
 * 返回是否匹配以及匹配到的词。
 */
export function preMatchKeyword(
  text: string,
  expandedKeywords: string[]
): PreMatchResult {
  if (!text || expandedKeywords.length === 0) {
    return { matched: false, matchedTerms: [], bestMatch: '' };
  }

  const lowerText = text.toLowerCase();
  const matchedTerms: string[] = [];
  let bestMatch = '';

  for (const kw of expandedKeywords) {
    const lowerKw = kw.toLowerCase();
    if (lowerKw && lowerText.includes(lowerKw)) {
      matchedTerms.push(kw);
      if (kw.length > bestMatch.length) {
        bestMatch = kw;
      }
    }
  }

  return {
    matched: matchedTerms.length > 0,
    matchedTerms,
    bestMatch,
  };
}
