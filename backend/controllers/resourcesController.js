const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    let query = 'SELECT id, title, description, category, subject, grade_level, file_url, file_type, file_size, external_url, download_count, is_featured, uploaded_by, created_at FROM resources WHERE is_published = 1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (search) { query += ' AND (title LIKE ? OR description LIKE ? OR subject LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    query += ' ORDER BY is_featured DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM resources WHERE is_published = 1' + (category ? ' AND category = ?' : ''),
      category ? [category] : []
    );

    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch resources', error: err.message });
  }
};

const download = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM resources WHERE id = ? AND is_published = 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Resource not found' });
    await db.query('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { file_url: rows[0].file_url, external_url: rows[0].external_url } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to process download', error: err.message });
  }
};

module.exports = { getAll, download };
