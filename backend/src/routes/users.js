const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', (req, res) => {
  const users = getDb().prepare(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name'
  ).all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { name, email, password, role = 'staff' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  const validRoles = ['staff', 'manager', 'secretary', 'admin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hash = bcrypt.hashSync(password, 10);
  const result = getDb().prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name, email.toLowerCase(), hash, role);

  const user = getDb().prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(user);
});

router.put('/:id', (req, res) => {
  const { name, email, role, password, is_active } = req.body;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates = {
    name: name ?? user.name,
    email: email?.toLowerCase() ?? user.email,
    role: role ?? user.role,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
    password_hash: password ? bcrypt.hashSync(password, 10) : user.password_hash
  };

  db.prepare(`
    UPDATE users SET name = ?, email = ?, role = ?, is_active = ?, password_hash = ? WHERE id = ?
  `).run(updates.name, updates.email, updates.role, updates.is_active, updates.password_hash, req.params.id);

  const updated = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?')
    .get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  getDb().prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deactivated' });
});

module.exports = router;
