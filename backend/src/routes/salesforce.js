const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getSalesforceStatus, connectSalesforce } = require('../services/salesforceService');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/status', (req, res) => {
  res.json(getSalesforceStatus());
});

router.post('/connect', async (req, res) => {
  try {
    const result = await connectSalesforce();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
