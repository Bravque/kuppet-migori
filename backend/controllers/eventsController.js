const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { upcoming, limit = 10, offset = 0 } = req.query;
    let query = 'SELECT * FROM events WHERE is_published = 1';
    const params = [];

    if (upcoming === 'true') {
      query += ' AND event_date >= CURDATE()';
    }

    query += ' ORDER BY event_date ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch events', error: err.message });
  }
};

const getUpcoming = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM events WHERE is_published = 1 AND event_date >= CURDATE() ORDER BY event_date ASC LIMIT 5'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch events', error: err.message });
  }
};

module.exports = { getAll, getUpcoming };
