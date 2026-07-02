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

// Keys the settings editor is allowed to write. Prevents junk/typo keys being created
// via INSERT ... ON DUPLICATE KEY UPDATE (which would silently make arbitrary rows).
const ALLOWED_SETTING_KEYS = new Set([
  'total_members', 'schools_covered', 'years_serving', 'resources_count',
  'chairman_message', 'chairman_name', 'chairman_title',
  'office_phone', 'office_email', 'office_address', 'whatsapp_channel',
]);

// Admin: update a setting
router.put('/:key', authenticate, authorizeSuperAdmin, auditLog('settings.update'), async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined || value === null) return res.status(400).json({ success: false, message: 'Value required' });
    if (typeof value !== 'string' && typeof value !== 'number') {
      return res.status(400).json({ success: false, message: 'Value must be a string or number' });
    }
    const strValue = String(value);
    if (strValue.length > 5000) return res.status(400).json({ success: false, message: 'Value too long (max 5000 characters)' });
    if (!ALLOWED_SETTING_KEYS.has(req.params.key)) {
      return res.status(400).json({ success: false, message: 'Unknown setting key' });
    }
    await db.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [req.params.key, strValue, strValue]
    );
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

module.exports = router;
