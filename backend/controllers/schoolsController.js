const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');

// Public: the list of active school names for the autocomplete datalist. No auth
// (the registration form is public). Optional ?q= narrows it; otherwise the full
// active list is returned (a branch has a few hundred schools at most).
async function getPublic(req, res) {
  try {
    const { q } = req.query;
    let sql = 'SELECT name FROM schools WHERE is_active = 1';
    const params = [];
    if (q) { sql += ' AND name LIKE ?'; params.push(`%${q}%`); }
    sql += ' ORDER BY name ASC LIMIT 1000';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows.map(r => r.name) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch schools' });
  }
}

// Admin: paginated management list (search + active filter).
async function adminGetAll(req, res) {
  try {
    const { search, active, limit = 25, offset = 0 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND name LIKE ?'; params.push(`%${search}%`); }
    if (active === 'true') where += ' AND is_active = 1';
    else if (active === 'false') where += ' AND is_active = 0';
    const [rows] = await db.query(
      `SELECT * FROM schools ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, clampLimit(limit, 25), clampOffset(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM schools ${where}`, params);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch schools' });
  }
}

async function adminCreate(req, res) {
  try {
    const name = (req.body.name || '').trim();
    const sub_county = (req.body.sub_county || '').trim() || null;
    if (!name) return res.status(400).json({ success: false, message: 'School name required' });
    const [result] = await db.query(
      'INSERT INTO schools (name, sub_county) VALUES (?, ?)',
      [name, sub_county]
    );
    const [[row]] = await db.query('SELECT * FROM schools WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That school is already on the list' });
    res.status(500).json({ success: false, message: 'Failed to add school' });
  }
}

async function adminUpdate(req, res) {
  try {
    const [[existing]] = await db.query('SELECT id FROM schools WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'School not found' });
    const fields = [], params = [];
    if (req.body.name !== undefined) { const n = (req.body.name || '').trim(); if (!n) return res.status(400).json({ success: false, message: 'School name cannot be empty' }); fields.push('name = ?'); params.push(n); }
    if (req.body.sub_county !== undefined) { fields.push('sub_county = ?'); params.push((req.body.sub_county || '').trim() || null); }
    if (req.body.is_active !== undefined) { fields.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE schools SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM schools WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Another school already has that name' });
    res.status(500).json({ success: false, message: 'Failed to update school' });
  }
}

async function adminRemove(req, res) {
  try {
    await db.query('DELETE FROM schools WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'School removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove school' });
  }
}

module.exports = { getPublic, adminGetAll, adminCreate, adminUpdate, adminRemove };
