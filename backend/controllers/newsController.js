const db = require('../config/database');
const { sanitizeRichText } = require('../utils/sanitizeHtml');

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

// FormData sends booleans/checkboxes as strings ('true'/'false'/'on'); JSON sends real booleans.
const truthy = (v) => v === true || v === 'true' || v === '1' || v === 'on';
const fileUrl = (f) => (f ? `/uploads/news/${f.filename}` : null);

const adminCreate = async (req, res) => {
  try {
    const { title, excerpt, category, featured_image, author, is_featured, is_published, tags } = req.body;
    if (!title || !req.body.content) return res.status(400).json({ success: false, message: 'Title and content required' });
    const content = sanitizeRichText(req.body.content); // rendered raw on the public site — strip XSS

    const files = req.files || {};
    const image1 = fileUrl(files.image1?.[0]) || featured_image || null;
    const image2 = fileUrl(files.image2?.[0]) || req.body.image_2 || null;
    const docFile = files.document?.[0];
    const docUrl = fileUrl(docFile) || req.body.document_url || null;
    const docName = docFile ? docFile.originalname : (req.body.document_name || null);

    let slug = slugify(title);
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM news WHERE slug LIKE ?', [`${slug}%`]);
    if (count > 0) slug = `${slug}-${Date.now()}`;

    const [result] = await db.query(
      `INSERT INTO news (title, slug, excerpt, content, category, featured_image, image_2,
         document_url, document_name, author, is_featured, is_published, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, excerpt || null, content, category || 'news', image1, image2,
       docUrl, docName, author || 'KUPPET Migori',
       truthy(is_featured) ? 1 : 0, is_published === undefined || truthy(is_published) ? 1 : 0, tags || null]
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

    const files = req.files || {};
    const fields = [], params = [];
    if (title !== undefined)          { fields.push('title = ?'); params.push(title); }
    if (excerpt !== undefined)        { fields.push('excerpt = ?'); params.push(excerpt); }
    if (content !== undefined)        { fields.push('content = ?'); params.push(sanitizeRichText(content)); }
    if (category !== undefined)       { fields.push('category = ?'); params.push(category); }
    if (author !== undefined)         { fields.push('author = ?'); params.push(author); }
    if (is_featured !== undefined)    { fields.push('is_featured = ?'); params.push(truthy(is_featured) ? 1 : 0); }
    if (is_published !== undefined)   { fields.push('is_published = ?'); params.push(truthy(is_published) ? 1 : 0); }
    if (tags !== undefined)           { fields.push('tags = ?'); params.push(tags); }

    // Images: a newly uploaded file wins; otherwise honour an explicit URL/clear from the body.
    if (files.image1?.[0])            { fields.push('featured_image = ?'); params.push(fileUrl(files.image1[0])); }
    else if (featured_image !== undefined) { fields.push('featured_image = ?'); params.push(featured_image || null); }
    if (files.image2?.[0])            { fields.push('image_2 = ?'); params.push(fileUrl(files.image2[0])); }
    else if (req.body.image_2 !== undefined) { fields.push('image_2 = ?'); params.push(req.body.image_2 || null); }

    // Document: a new upload replaces both url + original name.
    if (files.document?.[0]) {
      fields.push('document_url = ?');  params.push(fileUrl(files.document[0]));
      fields.push('document_name = ?'); params.push(files.document[0].originalname);
    } else if (req.body.document_url !== undefined) {
      fields.push('document_url = ?');  params.push(req.body.document_url || null);
      fields.push('document_name = ?'); params.push(req.body.document_name || null);
    }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM news WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update article' });
  }
};

const adminGetOne = async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM news WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch article' });
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

module.exports = { getAll, getOne, getFeatured, adminCreate, adminUpdate, adminRemove, adminGetAll, adminGetOne };
