import OpenAI from 'openai';

// Lazy initialization — only when API key is available
let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      console.warn('⚠️  DEEPSEEK_API_KEY is not configured — AI features disabled');
      return null;
    }
    client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey,
    });
    console.log('🤖 DeepSeek client initialized');
  }
  return client;
}

export interface VerifyResult {
  isRelevant: boolean;
  isFake: boolean;
  score: number;
  summary: string;
  reason: string;
  keywordMentioned: boolean;
  importance: 'low' | 'medium' | 'high' | 'urgent';
  relevanceReason: string;
}

/**
 * Use DeepSeek to verify if a piece of content is genuinely related to the keyword
 * and not fake/spam content. Output includes importance grading and relevance reasoning.
 */
export async function verifyContent(
  title: string,
  content: string,
  keyword: string,
  preMatchHint?: string
): Promise<VerifyResult> {
  const ai = getClient();
  if (!ai) {
    return {
      isRelevant: true, isFake: false, score: 50, summary: '',
      reason: 'AI 未配置，跳过验证',
      keywordMentioned: false, importance: 'low', relevanceReason: '',
    };
  }

  const matchHint = preMatchHint || '';

  const systemPrompt = `你是一个热点内容精准匹配专家。你的任务是判断一段内容是否与指定的监控关键词【${keyword}】直接相关。

${matchHint}

分析要点：
1. 判断是否为真实有价值的信息（排除标题党、假新闻、营销软文）
2. 判断内容是否【直接】涉及关键词"${keyword}"。注意：
   - 仅仅属于同一领域但未提及关键词的内容，相关性应低于 40 分
   - 内容必须直接讨论、提及或与"${keyword}"有实质关联才能获得 60 分以上
   - 只是间接沾边（如同类产品、同领域但不同主题）应给 30-50 分
3. 判断内容中是否直接提及了"${keyword}"或其等价表述（keywordMentioned）
4. 评估热点的重要程度（对关注"${keyword}"的人来说有多重要）
5. 用一句话解释此内容与"${keyword}"的关联
6. 用一句话解释你的相关性打分理由

请以 JSON 格式输出：
{
  "isRelevant": true/false,
  "isFake": true/false,
  "score": 0-100,
  "keywordMentioned": true/false,
  "importance": "low/medium/high/urgent",
  "summary": "此内容与【${keyword}】的关联：一句话",
  "relevanceReason": "相关性打分理由：一句话",
  "reason": "综合判断理由简述"
}`;

  const userPrompt = `请验证以下内容是否与【${keyword}】真正相关：

【标题】${title}

【正文】${content || '（无正文，仅标题）'}`;

  try {
    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      isRelevant: result.isRelevant ?? true,
      isFake: result.isFake ?? false,
      score: Math.min(100, Math.max(0, result.score ?? 50)),
      summary: result.summary ?? '',
      reason: result.reason ?? '',
      keywordMentioned: result.keywordMentioned ?? false,
      importance: ['low', 'medium', 'high', 'urgent'].includes(result.importance) ? result.importance : 'low',
      relevanceReason: result.relevanceReason ?? '',
    };
  } catch (err) {
    console.error('DeepSeek API error:', err);
    return {
      isRelevant: true, isFake: false, score: 50, summary: '',
      reason: 'AI verification failed, defaulting to pass',
      keywordMentioned: false, importance: 'low', relevanceReason: '',
    };
  }
}

/**
 * Use DeepSeek to discover trending topics in a given category.
 */
export async function discoverTrendingTopics(
  category: string
): Promise<{ topics: string[]; summary: string }> {
  const ai = getClient();
  if (!ai) return { topics: [], summary: 'AI 未配置，无法发现热点' };

  const systemPrompt = `你是一个热点趋势分析助手。请根据用户指定的领域，列出当前可能的热门话题。
返回 JSON 格式：
{
  "topics": ["话题1", "话题2", ...],
  "summary": "该领域当前趋势的简要概述（1-2句）"
}`;

  try {
    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请列出"${category}"领域当前最值得关注的5-8个热门话题。` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    });

    return JSON.parse(response.choices[0].message.content || '{"topics":[],"summary":""}');
  } catch (err) {
    console.error('DeepSeek trending discovery error:', err);
    return { topics: [], summary: '' };
  }
}

/**
 * Check if DeepSeek API key is configured and working.
 */
export async function checkApiStatus(): Promise<boolean> {
  try {
    const ai = getClient();
    if (!ai) return false;
    await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    });
    return true;
  } catch {
    return false;
  }
}
