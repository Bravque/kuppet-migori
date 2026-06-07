const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { category, featured, limit = 10, offset = 0, search } = req.query;
    let query = 'SELECT id, title, slug, excerpt, category, featured_image, author, is_featured, views, tags, published_at FROM news WHERE is_published = 1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (featured === 'true') { query += ' AND is_featured = 1'; }
    if (search) { query += ' AND (title LIKE ? OR excerpt LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM news WHERE is_published = 1' + (category ? ' AND category = ?' : ''),
      category ? [category] : []
    );

    res.json({ success: true, data: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch news', error: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM news WHERE slug = ? AND is_published = 1', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Article not found' });
    await db.query('UPDATE news SET views = views + 1 WHERE id = ?', [rows[0].id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch article', error: err.message });
  }
};

const getFeatured = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, slug, excerpt, category, featured_image, author, published_at FROM news WHERE is_published = 1 AND is_featured = 1 ORDER BY published_at DESC LIMIT 3'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch featured news', error: err.message });
  }
};

module.exports = { getAll, getOne, getFeatured };
