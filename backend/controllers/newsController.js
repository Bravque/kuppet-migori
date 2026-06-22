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
    res.status(500).json({ success: false, message: 'Failed to fetch news' });
  }
};

const getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM news WHERE slug = ? AND is_published = 1', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Article not found' });
    await db.query('UPDATE news SET views = views + 1 WHERE id = ?', [rows[0].id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch article' });
  }
};

const getFeatured = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, slug, excerpt, category, featured_image, author, published_at FROM news WHERE is_published = 1 AND is_featured = 1 ORDER BY published_at DESC LIMIT 3'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch featured news' });
  }
};

// ── Admin methods ────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const adminCreate = async (req, res) => {
  try {
    const { title, excerpt, content, category, featured_image, author, is_featured, is_published, tags } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required' });

    let slug = slugify(title);
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM news WHERE slug LIKE ?', [`${slug}%`]);
    if (count > 0) slug = `${slug}-${Date.now()}`;

    const [result] = await db.query(
      `INSERT INTO news (title, slug, excerpt, content, category, featured_image, author,
         is_featured, is_published, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, excerpt || null, content, category || 'news', featured_image || null,
       author || 'KUPPET Migori', is_featured ? 1 : 0, is_published !== false ? 1 : 0, tags || null]
    );
    const [[row]] = await db.query('SELECT * FROM news WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create article' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const { title, excerpt, content, category, featured_image, author, is_featured, is_published, tags } = req.body;
    const [[existing]] = await db.query('SELECT id FROM news WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Article not found' });

    const fields = [], params = [];
    if (title !== undefined)          { fields.push('title = ?'); params.push(title); }
    if (excerpt !== undefined)        { fields.push('excerpt = ?'); params.push(excerpt); }
    if (content !== undefined)        { fields.push('content = ?'); params.push(content); }
    if (category !== undefined)       { fields.push('category = ?'); params.push(category); }
    if (featured_image !== undefined) { fields.push('featured_image = ?'); params.push(featured_image); }
    if (author !== undefined)         { fields.push('author = ?'); params.push(author); }
    if (is_featured !== undefined)    { fields.push('is_featured = ?'); params.push(is_featured ? 1 : 0); }
    if (is_published !== undefined)   { fields.push('is_published = ?'); params.push(is_published ? 1 : 0); }
    if (tags !== undefined)           { fields.push('tags = ?'); params.push(tags); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM news WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update article' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM news WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Article not found' });
    await db.query('DELETE FROM news WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Article deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete article' });
  }
};

const adminGetAll = async (req, res) => {
  try {
    const { category, limit = 20, offset = 0, search } = req.query;
    let query = 'SELECT id, title, slug, category, author, is_featured, is_published, views, published_at FROM news WHERE 1=1';
    const params = [];
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (search) { query += ' AND title LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM news WHERE 1=1' + (category ? ' AND category = ?' : ''), category ? [category] : []);
    res.json({ success: true, data: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch news' });
  }
};

module.exports = { getAll, getOne, getFeatured, adminCreate, adminUpdate, adminRemove, adminGetAll };
