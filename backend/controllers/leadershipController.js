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
    res.status(500).json({ success: false, message: 'Failed to fetch leadership', error: err.message });
  }
};

module.exports = { getAll };
