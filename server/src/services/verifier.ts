import db from '../db.js';
import { verifyContent } from '../lib/deepseek.js';
import { calculateRelevance } from '../lib/relevance.js';
import { preMatchKeyword } from '../lib/pre-match.js';
import { expandKeyword } from '../lib/query-expansion.js';
import { sseHub } from '../lib/sse.js';

/** Discard results older than this many days */
const MAX_AGE_DAYS = 7;

/** Relevance threshold: discard below this */
const MIN_RELEVANCE = 50;
/** If keyword not mentioned, require higher relevance to pass */
const MIN_RELEVANCE_NO_MENTION = 65;

/**
 * Layered verification pipeline:
 * 1. Pre-match: check if expanded keywords appear in text
 * 2. Freshness: discard too-old content
 * 3. AI / fallback scoring
 * 4. Threshold filtering: apply relevance + keywordMentioned rules
 */
export async function verifyPendingHotspots(): Promise<number> {
  const unverified = db.prepare(`
    SELECT id, title, summary, keyword_match, published_at FROM hotspots
    WHERE ai_verified = 0
    ORDER BY created_at ASC
    LIMIT 20
  `).all() as { id: number; title: string; summary: string; keyword_match: string; published_at: string }[];

  if (unverified.length === 0) return 0;

  // Load active keywords for pre-matching
  const activeKeywords = db.prepare('SELECT keyword FROM keywords WHERE active = 1').all() as { keyword: string }[];
  
  // Build expanded keyword set (with cache from collector)
  const expandedKwMap = new Map<string, string[]>();
  for (const { keyword } of activeKeywords) {
    if (!expandedKwMap.has(keyword)) {
      expandedKwMap.set(keyword, await expandKeyword(keyword));
    }
  }

  console.log(`🔍 Verifying ${unverified.length} pending hotspots...`);

  let verifiedCount = 0;
  let filteredByPreMatch = 0;
  let filteredByFreshness = 0;
  let filteredByThreshold = 0;

  for (const hotspot of unverified) {
    try {
      const fullText = hotspot.title + '\n' + (hotspot.summary || '');
      const keyword = hotspot.keyword_match || hotspot.title;

      // ---- Layer 1: Pre-match check ----
      const expandedKws = expandedKwMap.get(keyword) || await expandKeyword(keyword);
      const preMatch = preMatchKeyword(fullText, expandedKws);

      // ---- Layer 2: Freshness filter ----
      const publishedAt = hotspot.published_at ? new Date(hotspot.published_at) : null;
      const isFresh = !publishedAt || (Date.now() - publishedAt.getTime()) < MAX_AGE_DAYS * 86400_000;
      if (!isFresh) {
        db.prepare(`UPDATE hotspots SET ai_verified = 1, ai_score = 0, ai_summary = '过期内容', is_fake = 0, keyword_mentioned = 0, importance = 'low', relevance_reason = '超过保留时限' WHERE id = ?`).run(hotspot.id);
        filteredByFreshness++;
        verifiedCount++;
        continue;
      }

      // ---- Layer 3: AI / fallback scoring ----
      // Build pre-match hint for AI
      const preMatchHint = preMatch.matched
        ? `预匹配: 文本中包含关键词变体：${preMatch.matchedTerms.join('、')}`
        : `预匹配: 文本中未直接提及关键词"${keyword}"的任何变体，请特别严格审核相关性`;

      const aiResult = await verifyContent(hotspot.title, hotspot.summary, keyword, preMatchHint);
      const isAiAvailable = aiResult.reason !== 'AI 未配置，跳过验证';

      const fallbackResult = calculateRelevance(hotspot.title, hotspot.summary, keyword);
      
      // Merge: AI result takes priority where available
      const score = isAiAvailable ? aiResult.score : fallbackResult.score;
      const summary = isAiAvailable ? aiResult.summary : fallbackResult.summary;
      const isFake = isAiAvailable ? aiResult.isFake : false;
      const keywordMentioned = isAiAvailable ? aiResult.keywordMentioned : fallbackResult.keywordMentioned;
      const importance = isAiAvailable ? aiResult.importance : fallbackResult.importance;
      const relevanceReason = isAiAvailable ? aiResult.relevanceReason : fallbackResult.relevanceReason;

      // ---- Layer 4: Threshold filtering ----
      // Filter out fake/spam
      if (isAiAvailable && isFake) {
        db.prepare(`UPDATE hotspots SET ai_verified = 1, ai_score = 0, ai_summary = @s, is_fake = 1, keyword_mentioned = @km, importance = 'low', relevance_reason = @rr WHERE id = @id`)
          .run({ s: summary, km: keywordMentioned ? 1 : 0, rr: relevanceReason, id: hotspot.id });
        filteredByThreshold++;
        verifiedCount++;
        continue;
      }

      // Filter by relevance threshold
      if (score < MIN_RELEVANCE) {
        db.prepare(`UPDATE hotspots SET ai_verified = 1, ai_score = @sc, ai_summary = @s, is_fake = 0, keyword_mentioned = @km, importance = 'low', relevance_reason = @rr WHERE id = @id`)
          .run({ sc: score, s: summary, km: keywordMentioned ? 1 : 0, rr: relevanceReason, id: hotspot.id });
        console.log(`  ⏭ Low relevance (${score}): ${hotspot.title.slice(0, 40)}...`);
        filteredByThreshold++;
        verifiedCount++;
        continue;
      }

      // Extra rule: keyword not mentioned AND relevance below higher threshold
      if (!keywordMentioned && score < MIN_RELEVANCE_NO_MENTION) {
        db.prepare(`UPDATE hotspots SET ai_verified = 1, ai_score = @sc, ai_summary = @s, is_fake = 0, keyword_mentioned = @km, importance = 'low', relevance_reason = @rr WHERE id = @id`)
          .run({ sc: score, s: summary, km: keywordMentioned ? 1 : 0, rr: relevanceReason, id: hotspot.id });
        console.log(`  ⏭ KW not mentioned & score<${MIN_RELEVANCE_NO_MENTION} (${score}): ${hotspot.title.slice(0, 40)}...`);
        filteredByThreshold++;
        verifiedCount++;
        continue;
      }

      // ---- Save: passed all filters ----
      db.prepare(`
        UPDATE hotspots
        SET ai_verified = 1, ai_score = @sc, ai_summary = @s, is_fake = 0,
            keyword_mentioned = @km, importance = @imp, relevance_reason = @rr
        WHERE id = @id
      `).run({ sc: score, s: summary, km: keywordMentioned ? 1 : 0, imp: importance, rr: relevanceReason, id: hotspot.id });

      // Create notification
      const notifResult = db.prepare(`
        INSERT INTO notifications (type, title, message, hotspot_id)
        VALUES ('hotspot', @title, @message, @hotspotId)
      `).run({
        title: `🔥 ${hotspot.title}`,
        message: summary || hotspot.summary,
        hotspotId: hotspot.id,
      });

      sseHub.broadcast('new-hotspot', {
        id: hotspot.id,
        title: hotspot.title,
        summary: summary || hotspot.summary,
        score,
        importance,
        keywordMentioned,
        notificationId: Number(notifResult.lastInsertRowid),
      });

      verifiedCount++;
    } catch (err) {
      console.error(`Failed to verify hotspot #${hotspot.id}:`, err);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`✅ Verified ${verifiedCount} hotspots | filtered: freshness=${filteredByFreshness} threshold=${filteredByThreshold}`);
  return verifiedCount;
}

/**
 * Verify a single hotspot by ID.
 */
export async function verifySingleHotspot(id: number): Promise<boolean> {
  const hotspot = db.prepare('SELECT * FROM hotspots WHERE id = ?').get(id) as any;
  if (!hotspot) return false;

  try {
    const keyword = hotspot.keyword_match || hotspot.title;
    const expandedKws = await expandKeyword(keyword);
    const fullText = hotspot.title + '\n' + (hotspot.summary || '');
    const preMatch = preMatchKeyword(fullText, expandedKws);
    const preMatchHint = preMatch.matched
      ? `预匹配: 文本中包含关键词变体：${preMatch.matchedTerms.join('、')}`
      : '';

    const result = await verifyContent(hotspot.title, hotspot.summary, keyword, preMatchHint);
    const fallbackResult = calculateRelevance(hotspot.title, hotspot.summary, keyword);
    const isAiAvailable = result.reason !== 'AI 未配置，跳过验证';

    db.prepare(`
      UPDATE hotspots
      SET ai_verified = 1, ai_score = @sc, ai_summary = @s, is_fake = @fk,
          keyword_mentioned = @km, importance = @imp, relevance_reason = @rr
      WHERE id = @id
    `).run({
      sc: isAiAvailable ? result.score : fallbackResult.score,
      s: isAiAvailable ? result.summary : fallbackResult.summary,
      fk: isAiAvailable && result.isFake ? 1 : 0,
      km: isAiAvailable ? (result.keywordMentioned ? 1 : 0) : (fallbackResult.keywordMentioned ? 1 : 0),
      imp: isAiAvailable ? result.importance : fallbackResult.importance,
      rr: isAiAvailable ? result.relevanceReason : fallbackResult.relevanceReason,
      id,
    });

    return true;
  } catch (err) {
    console.error('verifySingleHotspot error:', err);
    return false;
  }
}
