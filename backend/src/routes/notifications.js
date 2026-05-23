const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, ROLE_LEVELS } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDb();
  const userLevel = ROLE_LEVELS[req.user.role] || 1;

  // Get notifications targeted at this user directly, or broadcast to this role level
  const notifications = db.prepare(`
    SELECT n.*, b.start_time, b.end_time, r.name as room_name
    FROM notifications n
    LEFT JOIN bookings b ON n.booking_id = b.id
    LEFT JOIN rooms r ON b.room_id = r.id
    WHERE (n.user_id = ? OR (n.target_role IS NOT NULL AND n.user_id IS NULL))
    ORDER BY n.created_at DESC
    LIMIT 100
  `).all(req.user.id);

  // Filter broadcast notifications by role level
  const visible = notifications.filter(n => {
    if (n.user_id === req.user.id) return true;
    if (n.target_role) {
      return userLevel >= (ROLE_LEVELS[n.target_role] || 0);
    }
    return false;
  });

  res.json(visible);
});

router.get('/unread-count', (req, res) => {
  const db = getDb();
  const userLevel = ROLE_LEVELS[req.user.role] || 1;

  const all = db.prepare(`
    SELECT n.is_read, n.target_role, n.user_id
    FROM notifications n
    WHERE (n.user_id = ? OR (n.target_role IS NOT NULL AND n.user_id IS NULL))
    AND n.is_read = 0
  `).all(req.user.id);

  const count = all.filter(n => {
    if (n.user_id === req.user.id) return true;
    if (n.target_role) return userLevel >= (ROLE_LEVELS[n.target_role] || 0);
    return false;
  }).length;

  res.json({ count });
});

router.put('/:id/read', (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marked as read' });
});

router.put('/read-all', (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
