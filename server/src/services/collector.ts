import db from '../db.js';

/** Simulated news sources for demo. In production, replace with real web scraping. */
const MOCK_SOURCES = [
  {
    name: '36氪',
    getHotspots: async (): Promise<MockHotspot[]> => [
      { title: 'DeepSeek 发布 V4 模型，推理能力大幅提升', summary: 'DeepSeek 最新发布的 V4 模型在多个基准测试中超越了 GPT-4o，引发行业关注。', source: '36氪' },
      { title: 'OpenAI 被曝正在开发 GPT-5，参数规模达万亿级', summary: '据知情人士透露，OpenAI 已启动 GPT-5 训练，预计2026年Q4发布。', source: '36氪' },
      { title: 'AI 编程工具 Cursor 完成 1 亿美元融资', summary: 'AI 编程助手 Cursor 宣布完成新一轮融资，估值达到 25 亿美元。', source: '36氪' },
    ],
  },
  {
    name: '掘金',
    getHotspots: async (): Promise<MockHotspot[]> => [
      { title: 'React 20 发布：全新的编译器架构', summary: 'React 团队发布了 React 20，带来全新的 React Forget 编译器，自动优化性能。', source: '掘金' },
      { title: 'TypeScript 6.0 Beta 发布，引入类型推导革新', summary: 'TypeScript 6.0 Beta 引入了全新的类型推导引擎，大幅减少类型标注需求。', source: '掘金' },
      { title: 'Vite 8 发布：构建速度再提升 50%', summary: 'Vite 8 基于 Rolldown 全新打包架构，构建速度相比 Vite 7 提升 50%。', source: '掘金' },
    ],
  },
  {
    name: 'InfoQ',
    getHotspots: async (): Promise<MockHotspot[]> => [
      { title: '大模型应用架构最佳实践 2026', summary: 'InfoQ 发布了 2026 年大模型应用架构指南，涵盖 RAG、Agent、多模态等方向。', source: 'InfoQ' },
      { title: 'Kubernetes 2.0 路线图公布', summary: 'CNCF 公布了 Kubernetes 2.0 路线图，将引入 Wasm 原生支持和边缘计算优化。', source: 'InfoQ' },
    ],
  },
];

interface MockHotspot {
  title: string;
  summary: string;
  source: string;
}

export interface CollectedHotspot {
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  category: string;
}

/**
 * Collect hotspots from multiple sources.
 * Currently uses mock data. Replace with real web scraping / RSS / APIs.
 */
export async function collectFromAllSources(category?: string): Promise<CollectedHotspot[]> {
  const allHotspots: CollectedHotspot[] = [];

  for (const source of MOCK_SOURCES) {
    try {
      const items = await source.getHotspots();
      for (const item of items) {
        allHotspots.push({
          title: item.title,
          summary: item.summary,
          source: item.source,
          sourceUrl: '',
          category: category || '综合',
        });
      }
    } catch (err) {
      console.error(`Failed to collect from ${source.name}:`, err);
    }
  }

  console.log(`📰 Collected ${allHotspots.length} hotspots from ${MOCK_SOURCES.length} sources`);
  return allHotspots;
}

/**
 * Search for content matching a specific keyword across sources.
 */
export async function searchByKeyword(keyword: string): Promise<CollectedHotspot[]> {
  // Get all hotspots first, then filter client-side for the demo.
  // In production, use real search APIs.
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
    INSERT OR IGNORE INTO hotspots (title, summary, source, source_url, keyword_match, category, published_at)
    VALUES (@title, @summary, @source, @sourceUrl, @keywordMatch, @category, datetime('now'))
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
      });
      if (result.changes > 0) {
        ids.push(Number(result.lastInsertRowid));
      }
    }
  });

  insertMany();
  return ids;
}
