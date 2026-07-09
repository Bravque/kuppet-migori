const db = require('../config/database');

// Public: active announcements for the homepage ticker, in display order.
const getActive = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, text, link FROM announcements WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

// Admin: every announcement (active + inactive) for management.
const adminGetAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM announcements ORDER BY sort_order ASC, created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

const adminCreate = async (req, res) => {
  try {
    const { text, link, sort_order, is_active } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Announcement text is required' });
    const [result] = await db.query(
      'INSERT INTO announcements (text, link, sort_order, is_active) VALUES (?, ?, ?, ?)',
      [text.trim(), link ? link.trim() : null, Number.isInteger(sort_order) ? sort_order : 0, is_active === false ? 0 : 1]
    );
    const [[row]] = await db.query('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM announcements WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const allowed = ['text', 'link', 'sort_order', 'is_active'];
    const fields = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        let val = req.body[key];
        if (key === 'is_active') val = val ? 1 : 0;
        if (key === 'text') val = String(val).trim();
        if (key === 'link') val = val ? String(val).trim() : null;
        fields.push(`${key} = ?`);
        params.push(val);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM announcements WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await db.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
};

module.exports = { getActive, adminGetAll, adminCreate, adminUpdate, adminRemove };
