const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, hasRole } = require('../middleware/auth');
const { testOutlookConnection } = require('../services/outlookService');

const router = express.Router();
router.use(authenticate);

function adminOnly(req, res, next) {
  if (!hasRole(req.user, 'admin')) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// GET /api/settings/outlook
router.get('/outlook', adminOnly, (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'outlook_%'").all();
  const raw = {};
  rows.forEach(r => { raw[r.key.replace('outlook_', '')] = r.value; });

  res.json({
    enabled: raw.enabled === 'true',
    tenantId: raw.tenant_id || '',
    clientId: raw.client_id || '',
    // Never send the actual secret back — just indicate whether one is saved
    clientSecret: '',
    hasSecret: !!(raw.client_secret)
  });
});

// POST /api/settings/outlook — save settings
router.post('/outlook', adminOnly, (req, res) => {
  const { enabled, tenantId, clientId, clientSecret } = req.body;
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  upsert.run('outlook_enabled', enabled ? 'true' : 'false');
  if (tenantId  !== undefined) upsert.run('outlook_tenant_id',  tenantId);
  if (clientId  !== undefined) upsert.run('outlook_client_id',  clientId);
  // Only update secret if a new one was actually provided (not the masked placeholder)
  if (clientSecret && clientSecret !== '••••••••') {
    upsert.run('outlook_client_secret', clientSecret);
  }

  res.json({ message: 'Outlook settings saved' });
});

// POST /api/settings/outlook/test — verify credentials
router.post('/outlook/test', adminOnly, async (req, res) => {
  const { tenantId, clientId, clientSecret } = req.body;

  // Fall back to stored values for any field not supplied
  const db = getDb();
  const stored = {};
  db.prepare("SELECT key, value FROM settings WHERE key LIKE 'outlook_%'").all()
    .forEach(r => { stored[r.key.replace('outlook_', '')] = r.value; });

  const tid = tenantId  || stored.tenant_id;
  const cid = clientId  || stored.client_id;
  const cs  = (clientSecret && clientSecret !== '••••••••') ? clientSecret : stored.client_secret;

  if (!tid || !cid || !cs) {
    return res.status(400).json({ error: 'Please fill in Tenant ID, Client ID, and Client Secret before testing' });
  }

  try {
    const orgName = await testOutlookConnection(tid, cid, cs);
    res.json({ success: true, message: `✓ Connected to: ${orgName}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
