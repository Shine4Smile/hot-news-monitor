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
  score: number;          // 0-100 relevance score
  summary: string;        // AI-generated summary
  reason: string;         // explanation
}

/**
 * Use DeepSeek to verify if a piece of content is genuinely related to the keyword
 * and not fake/spam content.
 */
export async function verifyContent(
  title: string,
  content: string,
  keyword: string
): Promise<VerifyResult> {
  const ai = getClient();
  if (!ai) {
    return { isRelevant: true, isFake: false, score: 50, summary: '', reason: 'AI 未配置，跳过验证' };
  }

  const systemPrompt = `你是一个专业的内容审核与验证助手。你的任务是：
1. 判断给定的内容是否**真正与关键词相关**（而非标题党、广告或无关内容）
2. 判断内容是否可能是**虚假信息**（标题党、虚假新闻、营销软文等）
3. 给出相关度评分（0-100）
4. 用1-2句话总结内容要点

请严格以 JSON 格式返回，格式如下：
{
  "isRelevant": true/false,
  "isFake": true/false,
  "score": 0-100,
  "summary": "1-2句内容总结",
  "reason": "判断理由简述"
}`;

  const userPrompt = `请验证以下内容：

【监控关键词】${keyword}

【内容标题】${title}

【内容正文】${content || '（无正文，仅标题）'}

请判断该内容是否与关键词"${keyword}"真正相关，以及是否为虚假/垃圾信息。`;

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
      isRelevant: result.isRelevant ?? false,
      isFake: result.isFake ?? false,
      score: result.score ?? 0,
      summary: result.summary ?? '',
      reason: result.reason ?? '',
    };
  } catch (err) {
    console.error('DeepSeek API error:', err);
    // Fallback: mark as unverified rather than failing
    return {
      isRelevant: true,
      isFake: false,
      score: 50,
      summary: '',
      reason: 'AI verification failed, defaulting to pass',
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
