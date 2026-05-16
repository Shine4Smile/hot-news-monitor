import { Router } from 'express';
import db from '../db.js';
import { checkApiStatus } from '../lib/deepseek.js';
import { sseHub } from '../lib/sse.js';

const router = Router();

// Get stats overview
router.get('/', async (_req, res) => {
  const totalKeywords = (db.prepare('SELECT COUNT(*) as count FROM keywords').get() as any).count;
  const activeKeywords = (db.prepare('SELECT COUNT(*) as count FROM keywords WHERE active = 1').get() as any).count;
  const totalHotspots = (db.prepare('SELECT COUNT(*) as count FROM hotspots').get() as any).count;
  const verifiedHotspots = (db.prepare('SELECT COUNT(*) as count FROM hotspots WHERE ai_verified = 1').get() as any).count;
  const fakeHotspots = (db.prepare('SELECT COUNT(*) as count FROM hotspots WHERE is_fake = 1').get() as any).count;
  const unreadNotifs = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any).count;
  const totalNotifs = (db.prepare('SELECT COUNT(*) as count FROM notifications').get() as any).count;

  let aiStatus = false;
  try {
    aiStatus = await checkApiStatus();
  } catch { /* ignore */ }

  res.json({
    keywords: { total: totalKeywords, active: activeKeywords },
    hotspots: { total: totalHotspots, verified: verifiedHotspots, fake: fakeHotspots },
    notifications: { total: totalNotifs, unread: unreadNotifs },
    sseClients: sseHub.clientCount,
    aiConnected: aiStatus,
  });
});

export default router;
