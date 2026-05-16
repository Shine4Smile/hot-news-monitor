import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List notifications
router.get('/', (req, res) => {
  const { page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

  const total = (db.prepare('SELECT COUNT(*) as count FROM notifications').get() as any).count;
  const notifications = db.prepare(
    `SELECT n.*, h.title as hotspot_title
     FROM notifications n
     LEFT JOIN hotspots h ON n.hotspot_id = h.id
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(parseInt(limit as string, 10), offset);

  res.json({ data: notifications, total, page: parseInt(page as string, 10), limit: parseInt(limit as string, 10) });
});

// Mark single notification as read
router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Mark all as read
router.put('/read-all', (_req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ success: true });
});

// Get unread count
router.get('/unread-count', (_req, res) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any;
  res.json({ count: result.count });
});

export default router;
