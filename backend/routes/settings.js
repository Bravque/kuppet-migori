const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

module.exports = router;
