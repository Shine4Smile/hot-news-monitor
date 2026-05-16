import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List all keywords
router.get('/', (_req, res) => {
  const keywords = db.prepare('SELECT * FROM keywords ORDER BY created_at DESC').all();
  res.json(keywords);
});

// Add a keyword
router.post('/', (req, res) => {
  const { keyword, category } = req.body;
  if (!keyword || !keyword.trim()) {
    res.status(400).json({ error: 'keyword is required' });
    return;
  }

  try {
    const result = db.prepare(
      'INSERT INTO keywords (keyword, category) VALUES (?, ?)'
    ).run(keyword.trim(), category || '通用');
    const created = db.prepare('SELECT * FROM keywords WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: '关键词已存在' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update a keyword
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { keyword, category, active } = req.body;

  const existing = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '关键词不存在' });
    return;
  }

  db.prepare(`
    UPDATE keywords
    SET keyword = COALESCE(?, keyword),
        category = COALESCE(?, category),
        active = COALESCE(?, active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(keyword?.trim() || null, category || null, active ?? null, id);

  const updated = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id);
  res.json(updated);
});

// Delete a keyword
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM keywords WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
