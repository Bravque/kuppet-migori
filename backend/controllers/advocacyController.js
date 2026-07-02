const db = require('../config/database');
const { sanitizeRichText } = require('../utils/sanitizeHtml');

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
    res.status(500).json({ success: false, message: 'Failed to fetch advocacy content' });
  }
};

const getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM advocacy WHERE slug = ? AND is_published = 1', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Content not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const adminCreate = async (req, res) => {
  try {
    const { title, category, document_url, is_featured, is_published } = req.body;
    if (!title || !req.body.content) return res.status(400).json({ success: false, message: 'Title and content required' });
    const content = sanitizeRichText(req.body.content); // rendered raw on the public site — strip XSS
    let slug = slugify(title);
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM advocacy WHERE slug LIKE ?', [`${slug}%`]);
    if (count > 0) slug = `${slug}-${Date.now()}`;
    const [result] = await db.query(
      'INSERT INTO advocacy (title, slug, content, category, document_url, is_featured, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, slug, content, category || 'rights', document_url || null, is_featured ? 1 : 0, is_published !== false ? 1 : 0]
    );
    const [[row]] = await db.query('SELECT * FROM advocacy WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create content' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM advocacy WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Content not found' });
    const allowed = ['title','content','category','document_url','is_featured','is_published'];
    const fields = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(key === 'content' ? sanitizeRichText(req.body[key]) : req.body[key]);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE advocacy SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM advocacy WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update content' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM advocacy WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Content not found' });
    await db.query('DELETE FROM advocacy WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Content deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete content' });
  }
};

module.exports = { getAll, getOne, adminCreate, adminUpdate, adminRemove };
