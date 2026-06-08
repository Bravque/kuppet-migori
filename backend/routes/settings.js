const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');

router.get('/stats', async (req, res) => {
  try {
    const keys = ['total_members', 'schools_covered', 'years_serving', 'resources_count', 'chairman_message', 'chairman_name', 'chairman_title'];
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?)', [keys]);
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// Admin: get all settings
router.get('/all', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings ORDER BY setting_key');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// Admin: update a setting
router.put('/:key', authenticate, authorizeSuperAdmin, auditLog('settings.update'), async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ success: false, message: 'Value required' });
    await db.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [req.params.key, value, value]
    );
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

module.exports = router;
