import db from '../db.js';
import { verifyContent } from '../lib/deepseek.js';
import { sseHub } from '../lib/sse.js';

/**
 * Verify all unverified hotspots using DeepSeek AI.
 */
export async function verifyPendingHotspots(): Promise<number> {
  const unverified = db.prepare(`
    SELECT id, title, summary, keyword_match FROM hotspots
    WHERE ai_verified = 0
    ORDER BY created_at ASC
    LIMIT 20
  `).all() as { id: number; title: string; summary: string; keyword_match: string }[];

  if (unverified.length === 0) return 0;

  console.log(`🔍 Verifying ${unverified.length} pending hotspots...`);

  let verifiedCount = 0;

  for (const hotspot of unverified) {
    try {
      const keyword = hotspot.keyword_match || hotspot.title;
      const result = await verifyContent(hotspot.title, hotspot.summary, keyword);

      db.prepare(`
        UPDATE hotspots
        SET ai_verified = 1,
            ai_score = @score,
            ai_summary = @aiSummary,
            is_fake = @isFake
        WHERE id = @id
      `).run({
        score: result.score,
        aiSummary: result.summary,
        isFake: result.isFake ? 1 : 0,
        id: hotspot.id,
      });

      // If relevant and not fake, create notification
      if (result.isRelevant && !result.isFake) {
        const notifResult = db.prepare(`
          INSERT INTO notifications (type, title, message, hotspot_id)
          VALUES ('hotspot', @title, @message, @hotspotId)
        `).run({
          title: `🔥 ${hotspot.title}`,
          message: result.summary || hotspot.summary,
          hotspotId: hotspot.id,
        });

        // Push via SSE
        sseHub.broadcast('new-hotspot', {
          id: hotspot.id,
          title: hotspot.title,
          summary: result.summary || hotspot.summary,
          score: result.score,
          notificationId: Number(notifResult.lastInsertRowid),
        });
      }

      verifiedCount++;
    } catch (err) {
      console.error(`Failed to verify hotspot #${hotspot.id}:`, err);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`✅ Verified ${verifiedCount} hotspots`);
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
    const result = await verifyContent(hotspot.title, hotspot.summary, keyword);

    db.prepare(`
      UPDATE hotspots
      SET ai_verified = 1, ai_score = @score, ai_summary = @aiSummary, is_fake = @isFake
      WHERE id = @id
    `).run({
      score: result.score,
      aiSummary: result.summary,
      isFake: result.isFake ? 1 : 0,
      id,
    });

    return true;
  } catch (err) {
    console.error('verifySingleHotspot error:', err);
    return false;
  }
}
