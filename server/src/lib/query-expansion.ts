/**
 * 关键词查询扩展（Query Expansion）
 * 
 * 将一个监控关键词拆分为多个搜索变体，提高信息检索的召回率。
 * - 纯文本拆词：无 AI 也能用，基于中文分词启发式
 * - AI 扩展：配置 DeepSeek 后，用 AI 生成更多变体
 * 
 * 结果会被缓存，同一关键词不会重复处理。
 */

const expansionCache = new Map<string, string[]>();

/**
 * 纯文本拆词（不依赖 AI）
 * 从复合关键词中提取多个搜索变体
 */
export function extractCoreTerms(keyword: string): string[] {
  const terms = new Set<string>([keyword]);
  const trimmed = keyword.trim();

  // Split by common separators: spaces, dashes, etc.
  const parts = trimmed.split(/[\s\-–—，,、]+/).filter((p) => p.length > 0);
  for (const part of parts) {
    if (part.length >= 2) terms.add(part);
  }

  // Generate overlapping 2-char chunks for Chinese text
  const chineseOnly = trimmed.replace(/[a-zA-Z0-9\s\-–—，,、.]+/g, '');
  if (chineseOnly.length >= 3) {
    for (let i = 0; i <= chineseOnly.length - 2; i++) {
      terms.add(chineseOnly.slice(i, i + 2));
    }
  }

  // For mixed CN/EN keywords, add the English part alone
  const englishPart = trimmed.match(/[a-zA-Z0-9]+/g);
  if (englishPart) {
    for (const en of englishPart) {
      if (en.length >= 2) terms.add(en);
    }
  }

  // Add space-separated as a whole + individual parts
  if (parts.length > 1) {
    // First two parts together
    if (parts[0] && parts[1]) terms.add(`${parts[0]} ${parts[1]}`);
    // Last two parts together
    if (parts.length > 2 && parts[parts.length - 2] && parts[parts.length - 1]) {
      terms.add(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
    }
  }

  return [...terms];
}

/**
 * AI 驱动的查询扩展（需要 DeepSeek API Key）
 * 无 Key 时自动降级为纯文本拆词
 */
export async function expandKeyword(keyword: string): Promise<string[]> {
  // Cache hit
  if (expansionCache.has(keyword)) {
    return expansionCache.get(keyword)!;
  }

  // Always have core terms as base
  const coreTerms = extractCoreTerms(keyword);

  // Try AI expansion
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_api_key_here') {
    const result = [...coreTerms];
    expansionCache.set(keyword, result);
    return result;
  }

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个搜索查询扩展专家。给定一个监控关键词，生成该关键词的变体和相关检索词，用于搜索引擎查询。

规则：
1. 生成中文和英文变体（如果适用）
2. 包括同义词、缩写、全称、常见拼写变体
3. 包括上下位词（更宽泛和更具体的版本）
4. 每个变体不超过15个字
5. 输出纯 JSON 数组，如：["变体1", "变体2", ...]`,
        },
        {
          role: 'user',
          content: `请为关键词"${keyword}"生成5-8个搜索变体`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const aiTerms: string[] = JSON.parse(jsonMatch[0]);
      // Merge core terms + AI terms, deduplicate
      const merged = [...new Set([...coreTerms, ...aiTerms.filter((t) => t && t.length >= 2)])];
      expansionCache.set(keyword, merged);
      return merged;
    }
  } catch (err) {
    console.warn('AI keyword expansion failed, using text-based extraction:', (err as Error).message);
  }

  const result = [...coreTerms];
  expansionCache.set(keyword, result);
  return result;
}
