const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { upcoming, limit = 10, offset = 0 } = req.query;
    let where = 'WHERE is_published = 1';
    if (upcoming === 'true') {
      where += ' AND event_date >= CURDATE()';
    }

    const [rows] = await db.query(
      `SELECT * FROM events ${where} ORDER BY event_date DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM events ${where}`);
    res.json({ success: true, data: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

const getUpcoming = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM events WHERE is_published = 1 AND event_date >= CURDATE() ORDER BY event_date ASC LIMIT 5'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

const adminCreate = async (req, res) => {
  try {
    const { title, description, event_date, event_time, end_date, venue, venue_address, event_type, is_featured, is_published, registration_link } = req.body;
    if (!title || !event_date) return res.status(400).json({ success: false, message: 'Title and date required' });
    const [result] = await db.query(
      `INSERT INTO events (title, description, event_date, event_time, end_date, venue, venue_address, event_type, is_featured, is_published, registration_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, event_date, event_time || null, end_date || null, venue || null, venue_address || null,
       event_type || 'meeting', is_featured ? 1 : 0, is_published !== false ? 1 : 0, registration_link || null]
    );
    const [[row]] = await db.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM events WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });
    const allowed = ['title','description','event_date','event_time','end_date','venue','venue_address','event_type','is_featured','is_published','registration_link'];
    const fields = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM events WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });
    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};

module.exports = { getAll, getUpcoming, adminCreate, adminUpdate, adminRemove };
