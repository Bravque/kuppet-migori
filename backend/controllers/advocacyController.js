const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;
    let query = 'SELECT id, title, slug, category, is_featured, created_at FROM advocacy WHERE is_published = 1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY is_featured DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch advocacy content', error: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM advocacy WHERE slug = ? AND is_published = 1', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Content not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch content', error: err.message });
  }
};

module.exports = { getAll, getOne };
