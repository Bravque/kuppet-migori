const db = require('../config/database');

const CASE_TYPES = ['employment', 'disciplinary', 'criminal', 'civil', 'constitutional', 'appeal', 'other'];
const STATUSES = ['open', 'ongoing', 'on_hold', 'closed'];
const OUTCOMES = ['pending', 'won', 'lost', 'settled', 'withdrawn', 'dismissed'];

// Case list (shared branch-wide). Filter by status / type / search; returns total for pagination.
async function getAll(req, res) {
  try {
    const { status, case_type, search, limit = 25, offset = 0 } = req.query;
    let where = 'WHERE 1=1';
    const filterParams = [];
    if (status) { where += ' AND c.status = ?'; filterParams.push(status); }
    if (case_type) { where += ' AND c.case_type = ?'; filterParams.push(case_type); }
    if (search) {
      where += ' AND (c.title LIKE ? OR c.case_number LIKE ? OR c.plaintiff LIKE ? OR c.defendant LIKE ?)';
      const s = `%${search}%`;
      filterParams.push(s, s, s, s);
    }

    const [rows] = await db.query(
      `SELECT c.*, u.name AS officer_name
       FROM court_cases c LEFT JOIN users u ON c.officer_id = u.id
       ${where}
       ORDER BY (c.status = 'closed'), c.next_hearing_date IS NULL, c.next_hearing_date ASC, c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM court_cases c ${where}`, filterParams);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch court cases' });
  }
}

// Dashboard summary: counts + the nearest upcoming hearings.
async function getStats(req, res) {
  try {
    const [[counts]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status <> 'closed') AS active,
         SUM(status = 'closed') AS closed,
         SUM(next_hearing_date IS NOT NULL AND next_hearing_date >= CURDATE() AND status <> 'closed') AS upcoming_hearings
       FROM court_cases`
    );
    const [nextHearings] = await db.query(
      `SELECT id, case_number, title, court, next_hearing_date
       FROM court_cases
       WHERE status <> 'closed' AND next_hearing_date IS NOT NULL AND next_hearing_date >= CURDATE()
       ORDER BY next_hearing_date ASC LIMIT 5`
    );
    res.json({
      success: true,
      data: {
        total: counts.total || 0,
        active: Number(counts.active) || 0,
        closed: Number(counts.closed) || 0,
        upcoming_hearings: Number(counts.upcoming_hearings) || 0,
        next_hearings: nextHearings,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch court case stats' });
  }
}

async function getOne(req, res) {
  try {
    const [[c]] = await db.query(
      `SELECT c.*, u.name AS officer_name, cu.name AS created_by_name
       FROM court_cases c
       LEFT JOIN users u ON c.officer_id = u.id
       LEFT JOIN users cu ON c.created_by = cu.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!c) return res.status(404).json({ success: false, message: 'Court case not found' });
    const [updates] = await db.query(
      `SELECT up.*, u.name AS author_name
       FROM court_case_updates up LEFT JOIN users u ON up.created_by = u.id
       WHERE up.case_id = ? ORDER BY up.update_date DESC, up.id DESC`,
      [c.id]
    );
    res.json({ success: true, data: { ...c, updates } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch court case' });
  }
}

async function create(req, res) {
  try {
    const {
      case_number, title, court, case_type, plaintiff, defendant,
      status, outcome, filing_date, next_hearing_date, description, officer_id,
    } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Case title is required' });

    const [result] = await db.query(
      `INSERT INTO court_cases
         (case_number, title, court, case_type, plaintiff, defendant, status, outcome,
          filing_date, next_hearing_date, description, officer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_number || null, title.trim(), court || null,
        CASE_TYPES.includes(case_type) ? case_type : 'employment',
        plaintiff || null, defendant || null,
        STATUSES.includes(status) ? status : 'open',
        OUTCOMES.includes(outcome) ? outcome : 'pending',
        filing_date || null, next_hearing_date || null, description || null,
        officer_id || req.user.id, req.user.id,
      ]
    );
    const [[row]] = await db.query('SELECT * FROM court_cases WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create court case' });
  }
}

async function update(req, res) {
  try {
    const [[existing]] = await db.query('SELECT id FROM court_cases WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Court case not found' });

    const allowed = {
      case_number: v => v || null,
      title: v => (v && v.trim()) || undefined,     // never blank out the title
      court: v => v || null,
      case_type: v => (CASE_TYPES.includes(v) ? v : undefined),
      plaintiff: v => v || null,
      defendant: v => v || null,
      status: v => (STATUSES.includes(v) ? v : undefined),
      outcome: v => (OUTCOMES.includes(v) ? v : undefined),
      filing_date: v => v || null,
      next_hearing_date: v => v || null,
      description: v => v || null,
      officer_id: v => v || null,
    };
    const fields = [], params = [];
    for (const [key, norm] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        const val = norm(req.body[key]);
        if (val !== undefined) { fields.push(`${key} = ?`); params.push(val); }
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE court_cases SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM court_cases WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update court case' });
  }
}

async function remove(req, res) {
  try {
    const [[existing]] = await db.query('SELECT id FROM court_cases WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Court case not found' });
    await db.query('DELETE FROM court_case_updates WHERE case_id = ?', [req.params.id]);
    await db.query('DELETE FROM court_cases WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Court case deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete court case' });
  }
}

// Add a dated entry to a case's updates log.
async function addUpdate(req, res) {
  try {
    const [[c]] = await db.query('SELECT id FROM court_cases WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ success: false, message: 'Court case not found' });
    const { note, update_date } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ success: false, message: 'Update note is required' });
    await db.query(
      'INSERT INTO court_case_updates (case_id, update_date, note, created_by) VALUES (?, ?, ?, ?)',
      [c.id, update_date || new Date(), note.trim(), req.user.id]
    );
    // Touch the case so its updated_at reflects the latest activity.
    await db.query('UPDATE court_cases SET updated_at = NOW() WHERE id = ?', [c.id]);
    res.status(201).json({ success: true, message: 'Update added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add update' });
  }
}

module.exports = { getAll, getStats, getOne, create, update, remove, addUpdate };
