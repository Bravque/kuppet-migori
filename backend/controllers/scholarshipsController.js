const db = require('../config/database');

const SCHOLARSHIP_TYPES = ['kcse', 'kjsea', 'dte'];

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
    res.status(500).json({ success: false, message: 'Failed to fetch scholarships' });
  }
};

const adminCreate = async (req, res) => {
  try {
    const { title, provider, description, eligibility, benefits, application_deadline, application_link, contact_email, contact_phone, scholarship_type, is_active, is_featured } = req.body;
    if (!title || !provider || !description) return res.status(400).json({ success: false, message: 'Title, provider and description required' });
    if (scholarship_type && !SCHOLARSHIP_TYPES.includes(scholarship_type)) {
      return res.status(400).json({ success: false, message: 'Type must be one of: KCSE, KJSEA, DTE' });
    }
    const [result] = await db.query(
      `INSERT INTO scholarships (title, provider, description, eligibility, benefits, application_deadline, application_link, contact_email, contact_phone, scholarship_type, is_active, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, provider, description, eligibility || null, benefits || null, application_deadline || null,
       application_link || null, contact_email || null, contact_phone || null, scholarship_type || 'kcse',
       is_active !== false ? 1 : 0, is_featured ? 1 : 0]
    );
    const [[row]] = await db.query('SELECT * FROM scholarships WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create scholarship' });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM scholarships WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Scholarship not found' });
    if (req.body.scholarship_type !== undefined && !SCHOLARSHIP_TYPES.includes(req.body.scholarship_type)) {
      return res.status(400).json({ success: false, message: 'Type must be one of: KCSE, KJSEA, DTE' });
    }
    const allowed = ['title','provider','description','eligibility','benefits','application_deadline','application_link','contact_email','contact_phone','scholarship_type','is_active','is_featured'];
    const fields = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE scholarships SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM scholarships WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update scholarship' });
  }
};

const adminRemove = async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM scholarships WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Scholarship not found' });
    await db.query('DELETE FROM scholarships WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Scholarship deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete scholarship' });
  }
};

module.exports = { getAll, adminCreate, adminUpdate, adminRemove };
