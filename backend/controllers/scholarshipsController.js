const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { type, active = 'true', limit = 20, offset = 0 } = req.query;
    let query = 'SELECT * FROM scholarships WHERE 1=1';
    const params = [];

    if (active === 'true') { query += ' AND is_active = 1'; }
    if (type) { query += ' AND scholarship_type = ?'; params.push(type); }

    query += ' ORDER BY is_featured DESC, application_deadline ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch scholarships', error: err.message });
  }
};

module.exports = { getAll };
