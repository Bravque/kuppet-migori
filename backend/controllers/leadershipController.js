const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM leadership WHERE is_active = 1';
    const params = [];

    if (category) { query += ' AND position_category = ?'; params.push(category); }
    query += ' ORDER BY display_order ASC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch leadership' });
  }
};

const adminCreate = async (req, res) => {
  try {
    const { name, position, position_category, bio, email, phone, display_order } = req.body;
    if (!name || !position) return res.status(400).json({ success: false, message: 'Name and position required' });
    const photoUrl = req.file ? `/uploads/photos/${req.file.filename}` : null;
    const [result] = await db.query(
      'INSERT INTO leadership (name, position, position_category, photo_url, bio, email, phone, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, position, position_category || 'executive', photoUrl, bio || null, email || null, phone || null, display_order || 0]
    );
    const [[row]] = await db.query('SELECT * FROM leadership WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create leader' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM leadership WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Leader not found' });
    const fields = [], params = [];
    if (req.file) { fields.push('photo_url = ?'); params.push(`/uploads/photos/${req.file.filename}`); }
    const allowed = ['name','position','position_category','bio','email','phone','display_order','is_active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE leadership SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM leadership WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update leader' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM leadership WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Leader not found' });
    await db.query('DELETE FROM leadership WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Leader deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete leader' });
  }
};

module.exports = { getAll, adminCreate, adminUpdate, adminRemove };
