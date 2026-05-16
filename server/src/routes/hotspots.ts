import { Router } from 'express';
import db from '../db.js';
import { verifySingleHotspot } from '../services/verifier.js';

const router = Router();

// List hotspots with filters
router.get('/', (req, res) => {
  const { category, verified, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }
  if (verified === '1') {
    where += ' AND ai_verified = 1 AND is_fake = 0';
  } else if (verified === '0') {
    where += ' AND ai_verified = 0';
  }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM hotspots ${where}`).get(...params) as any).count;
  const hotspots = db.prepare(
    `SELECT * FROM hotspots ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit as string, 10), offset);

  res.json({ data: hotspots, total, page: parseInt(page as string, 10), limit: parseInt(limit as string, 10) });
});

// Get single hotspot
router.get('/:id', (req, res) => {
  const hotspot = db.prepare('SELECT * FROM hotspots WHERE id = ?').get(req.params.id);
  if (!hotspot) {
    res.status(404).json({ error: '热点不存在' });
    return;
  }
  res.json(hotspot);
});

// Verify a hotspot with AI
router.post('/:id/verify', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const success = await verifySingleHotspot(id);
  if (!success) {
    res.status(500).json({ error: '验证失败' });
    return;
  }
  const updated = db.prepare('SELECT * FROM hotspots WHERE id = ?').get(id);
  res.json(updated);
});

// Delete a hotspot
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM hotspots WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
