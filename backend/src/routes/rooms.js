const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => {
  const rooms = getDb().prepare('SELECT * FROM rooms WHERE is_active = 1 ORDER BY floor, name').all();
  res.json(rooms.map(r => ({ ...r, amenities: JSON.parse(r.amenities || '[]') })));
});

router.get('/:id', (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ ...room, amenities: JSON.parse(room.amenities || '[]') });
});

router.post('/', requireRole('secretary'), (req, res) => {
  const { name, type = 'conference', capacity = 1, floor, amenities = [], color = '#2563eb' } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name is required' });

  const result = getDb().prepare(
    'INSERT INTO rooms (name, type, capacity, floor, amenities, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, type, capacity, floor || null, JSON.stringify(amenities), color);

  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...room, amenities: JSON.parse(room.amenities) });
});

router.put('/:id', requireRole('secretary'), (req, res) => {
  const { name, type, capacity, floor, amenities, color } = req.body;
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  getDb().prepare(`
    UPDATE rooms SET name = ?, type = ?, capacity = ?, floor = ?, amenities = ?, color = ?
    WHERE id = ?
  `).run(
    name ?? room.name,
    type ?? room.type,
    capacity ?? room.capacity,
    floor ?? room.floor,
    JSON.stringify(amenities ?? JSON.parse(room.amenities)),
    color ?? room.color,
    req.params.id
  );

  const updated = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  res.json({ ...updated, amenities: JSON.parse(updated.amenities) });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const room = getDb().prepare('SELECT id FROM rooms WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  getDb().prepare('UPDATE rooms SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Room deactivated' });
});

module.exports = router;
