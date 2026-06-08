const db = require('../config/database');
const { validationResult } = require('express-validator');

const submit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, subject, message, category } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    await db.query(
      'INSERT INTO contacts (name, email, phone, subject, message, category, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, subject || null, message, category || 'general', ip]
    );

    res.json({ success: true, message: 'Your message has been received. We will respond within 2 business days.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit message. Please try again or call our office directly.' });
  }
};

const adminGetAll = async (req, res) => {
  try {
    const { status, category, limit = 20, offset = 0 } = req.query;
    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM contacts WHERE 1=1' +
      (status ? ' AND status = ?' : '') + (category ? ' AND category = ?' : ''),
      [...(status ? [status] : []), ...(category ? [category] : [])]
    );
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch contacts', error: err.message });
  }
};

const adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['new', 'read', 'replied', 'closed'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const [[existing]] = await db.query('SELECT id FROM contacts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Contact not found' });
    await db.query('UPDATE contacts SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status', error: err.message });
  }
};

module.exports = { submit, adminGetAll, adminUpdateStatus };
