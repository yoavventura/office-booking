const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, hasRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/tags — all tags (any authenticated user)
router.get('/', (req, res) => {
  const tags = getDb().prepare('SELECT * FROM tags ORDER BY name').all();
  res.json(tags);
});

// POST /api/tags — create (admin only)
router.post('/', (req, res) => {
  if (!hasRole(req.user, 'admin')) return res.status(403).json({ error: 'Admin only' });
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tag name is required' });
  try {
    const result = getDb()
      .prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
      .run(name.trim(), color || '#6366f1');
    const tag = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(tag);
  } catch {
    res.status(400).json({ error: 'A tag with that name already exists' });
  }
});

// PUT /api/tags/:id — update (admin only)
router.put('/:id', (req, res) => {
  if (!hasRole(req.user, 'admin')) return res.status(403).json({ error: 'Admin only' });
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tag name is required' });
  try {
    getDb()
      .prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?')
      .run(name.trim(), color, req.params.id);
    res.json(getDb().prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id));
  } catch {
    res.status(400).json({ error: 'A tag with that name already exists' });
  }
});

// DELETE /api/tags/:id — delete (admin only)
router.delete('/:id', (req, res) => {
  if (!hasRole(req.user, 'admin')) return res.status(403).json({ error: 'Admin only' });
  const inUse = getDb()
    .prepare("SELECT COUNT(*) as count FROM bookings WHERE tag_id = ? AND status != 'cancelled'")
    .get(req.params.id);
  if (inUse.count > 0) {
    return res.status(400).json({ error: `Cannot delete — used by ${inUse.count} active booking(s)` });
  }
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ message: 'Tag deleted' });
});

module.exports = router;
