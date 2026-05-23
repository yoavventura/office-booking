const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');

const ROLE_LEVELS = { staff: 1, manager: 2, secretary: 3, admin: 4 };

function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = getDb().prepare('SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    const requiredLevel = ROLE_LEVELS[minimumRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function hasRole(user, minimumRole) {
  return (ROLE_LEVELS[user?.role] || 0) >= (ROLE_LEVELS[minimumRole] || 0);
}

module.exports = { authenticate, requireRole, hasRole, ROLE_LEVELS };
