const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    let where = 'WHERE is_published = 1';
    const filterParams = [];

    if (category) { where += ' AND category = ?'; filterParams.push(category); }
    if (search) { where += ' AND (title LIKE ? OR description LIKE ? OR subject LIKE ?)'; filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const [rows] = await db.query(
      `SELECT id, title, description, category, subject, grade_level, file_url, file_type, file_size, external_url, download_count, is_featured, uploaded_by, created_at
       FROM resources ${where} ORDER BY is_featured DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM resources ${where}`, filterParams);

    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch resources' });
  }
};

const download = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM resources WHERE id = ? AND is_published = 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Resource not found' });
    await db.query('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { file_url: rows[0].file_url, external_url: rows[0].external_url } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to process download' });
  }
};

const adminCreate = async (req, res) => {
  try {
    const { title, description, category, subject, grade_level, file_url, file_type, file_size, external_url, is_featured, is_published, uploaded_by } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const fileUrl = file_url || (req.file ? `/uploads/documents/${req.file.filename}` : null);
    const [result] = await db.query(
      `INSERT INTO resources (title, description, category, subject, grade_level, file_url, file_type, file_size, external_url, is_featured, is_published, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, category || 'teaching_material', subject || null, grade_level || null,
       fileUrl, file_type || null, file_size || null, external_url || null, is_featured ? 1 : 0,
       is_published !== false ? 1 : 0, uploaded_by || 'KUPPET Migori']
    );
    const [[row]] = await db.query('SELECT * FROM resources WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create resource' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM resources WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Resource not found' });
    const allowed = ['title','description','category','subject','grade_level','file_url','file_type','file_size','external_url','is_featured','is_published','uploaded_by'];
    const fields = [], params = [];
    if (req.file) { fields.push('file_url = ?'); params.push(`/uploads/documents/${req.file.filename}`); }
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM resources WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update resource' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM resources WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Resource not found' });
    await db.query('DELETE FROM resources WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Resource deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete resource' });
  }
};

module.exports = { getAll, download, adminCreate, adminUpdate, adminRemove };
