import cron from 'node-cron';
import { collectFromAllSources, saveHotspots } from './collector.js';
import { verifyPendingHotspots } from './verifier.js';
import { sseHub } from '../lib/sse.js';

let collectTask: cron.ScheduledTask | null = null;
let verifyTask: cron.ScheduledTask | null = null;

/**
 * Start the cron scheduler for periodic collection and verification.
 */
export function startScheduler(): void {
  const collectInterval = parseInt(process.env.COLLECT_INTERVAL_MINUTES || '5', 10);
  const verifyInterval = parseInt(process.env.VERIFY_INTERVAL_MINUTES || '10', 10);

  // Collect hotspots periodically
  collectTask = cron.schedule(`*/${collectInterval} * * * *`, async () => {
    console.log('⏰ [Cron] Running hotspot collection...');
    try {
      const hotspots = await collectFromAllSources();
      const newIds = saveHotspots(hotspots);
      if (newIds.length > 0) {
        console.log(`📥 Added ${newIds.length} new hotspots`);
        sseHub.broadcast('collect-done', { newCount: newIds.length });
      }
    } catch (err) {
      console.error('Collection cron error:', err);
    }
  });

  // Verify unverified hotspots periodically
  verifyTask = cron.schedule(`*/${verifyInterval} * * * *`, async () => {
    console.log('⏰ [Cron] Running AI verification...');
    try {
      const count = await verifyPendingHotspots();
      if (count > 0) {
        console.log(`🤖 AI verified ${count} hotspots`);
      }
    } catch (err) {
      console.error('Verification cron error:', err);
    }
  });

  console.log(`⏱️  Scheduler started — collect every ${collectInterval}min, verify every ${verifyInterval}min`);
}

/**
 * Stop the scheduler gracefully.
 */
export function stopScheduler(): void {
  collectTask?.stop();
  verifyTask?.stop();
  console.log('⏱️  Scheduler stopped');
}

/**
 * Trigger immediate collection and verification (manual trigger).
 */
export async function triggerCollection(): Promise<number> {
  console.log('⚡ Manual collection triggered');
  const hotspots = await collectFromAllSources();
  const newIds = saveHotspots(hotspots);
  return newIds.length;
}

export async function triggerVerification(): Promise<number> {
  console.log('⚡ Manual verification triggered');
  return verifyPendingHotspots();
}
