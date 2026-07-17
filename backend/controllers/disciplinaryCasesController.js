const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');

const OFFENCES = ['misconduct', 'absenteeism', 'exam_irregularity', 'financial',
                  'insubordination', 'negligence', 'criminal', 'other'];
const STATUSES = ['reported', 'query_issued', 'interdicted', 'hearing', 'determined', 'appealed', 'closed'];
const OUTCOMES = ['pending', 'warning', 'suspension', 'dismissal', 'reinstated', 'cleared', 'other'];

// Case list (shared branch-wide). Filter by status / offence / search; returns total for pagination.
async function getAll(req, res) {
  try {
    const { status, offence_category, search, limit = 25, offset = 0 } = req.query;
    let where = 'WHERE 1=1';
    const filterParams = [];
    if (status) { where += ' AND c.status = ?'; filterParams.push(status); }
    if (offence_category) { where += ' AND c.offence_category = ?'; filterParams.push(offence_category); }
    if (search) {
      where += ' AND (c.teacher_name LIKE ? OR c.tsc_number LIKE ? OR c.school LIKE ? OR c.case_ref LIKE ?)';
      const s = `%${search}%`;
      filterParams.push(s, s, s, s);
    }

    const [rows] = await db.query(
      `SELECT c.*, u.name AS officer_name
       FROM disciplinary_cases c LEFT JOIN users u ON c.officer_id = u.id
       ${where}
       ORDER BY (c.status = 'closed'), c.hearing_date IS NULL, c.hearing_date ASC, c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, clampLimit(limit, 25), clampOffset(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM disciplinary_cases c ${where}`, filterParams);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch disciplinary cases' });
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
         SUM(status = 'interdicted') AS interdicted,
         SUM(hearing_date IS NOT NULL AND hearing_date >= CURDATE() AND status <> 'closed') AS upcoming_hearings
       FROM disciplinary_cases`
    );
    const [nextHearings] = await db.query(
      `SELECT id, case_ref, teacher_name, school, hearing_date
       FROM disciplinary_cases
       WHERE status <> 'closed' AND hearing_date IS NOT NULL AND hearing_date >= CURDATE()
       ORDER BY hearing_date ASC LIMIT 5`
    );
    res.json({
      success: true,
      data: {
        total: counts.total || 0,
        active: Number(counts.active) || 0,
        closed: Number(counts.closed) || 0,
        interdicted: Number(counts.interdicted) || 0,
        upcoming_hearings: Number(counts.upcoming_hearings) || 0,
        next_hearings: nextHearings,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch disciplinary case stats' });
  }
}

async function getOne(req, res) {
  try {
    const [[c]] = await db.query(
      `SELECT c.*, u.name AS officer_name, cu.name AS created_by_name
       FROM disciplinary_cases c
       LEFT JOIN users u ON c.officer_id = u.id
       LEFT JOIN users cu ON c.created_by = cu.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!c) return res.status(404).json({ success: false, message: 'Disciplinary case not found' });
    const [updates] = await db.query(
      `SELECT up.*, u.name AS author_name
       FROM disciplinary_case_updates up LEFT JOIN users u ON up.created_by = u.id
       WHERE up.case_id = ? ORDER BY up.update_date DESC, up.id DESC`,
      [c.id]
    );
    const [documents] = await db.query(
      `SELECT d.*, u.name AS uploaded_by_name
       FROM disciplinary_case_documents d LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.case_id = ? ORDER BY d.created_at DESC`,
      [c.id]
    );
    res.json({ success: true, data: { ...c, updates, documents } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch disciplinary case' });
  }
}

async function create(req, res) {
  try {
    const {
      case_ref, teacher_name, tsc_number, school, sub_county, offence_category,
      description, status, outcome, reported_date, interdiction_date, hearing_date, resolved_date, officer_id,
    } = req.body;
    if (!teacher_name || !teacher_name.trim()) {
      return res.status(400).json({ success: false, message: 'Teacher name is required' });
    }

    const [result] = await db.query(
      `INSERT INTO disciplinary_cases
         (case_ref, teacher_name, tsc_number, school, sub_county, offence_category, description,
          status, outcome, reported_date, interdiction_date, hearing_date, resolved_date, officer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_ref || null, teacher_name.trim(), tsc_number || null, school || null, sub_county || null,
        OFFENCES.includes(offence_category) ? offence_category : 'misconduct',
        description || null,
        STATUSES.includes(status) ? status : 'reported',
        OUTCOMES.includes(outcome) ? outcome : 'pending',
        reported_date || null, interdiction_date || null, hearing_date || null, resolved_date || null,
        officer_id || req.user.id, req.user.id,
      ]
    );
    const [[row]] = await db.query('SELECT * FROM disciplinary_cases WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create disciplinary case' });
  }
}

async function update(req, res) {
  try {
    const [[existing]] = await db.query('SELECT id FROM disciplinary_cases WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Disciplinary case not found' });

    const allowed = {
      case_ref: v => v || null,
      teacher_name: v => (v && v.trim()) || undefined,     // never blank out the teacher name
      tsc_number: v => v || null,
      school: v => v || null,
      sub_county: v => v || null,
      offence_category: v => (OFFENCES.includes(v) ? v : undefined),
      description: v => v || null,
      status: v => (STATUSES.includes(v) ? v : undefined),
      outcome: v => (OUTCOMES.includes(v) ? v : undefined),
      reported_date: v => v || null,
      interdiction_date: v => v || null,
      hearing_date: v => v || null,
      resolved_date: v => v || null,
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
    await db.query(`UPDATE disciplinary_cases SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[row]] = await db.query('SELECT * FROM disciplinary_cases WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update disciplinary case' });
  }
}

async function remove(req, res) {
  try {
    const [[existing]] = await db.query('SELECT id FROM disciplinary_cases WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Disciplinary case not found' });
    await db.query('DELETE FROM disciplinary_case_updates WHERE case_id = ?', [req.params.id]);
    await db.query('DELETE FROM disciplinary_case_documents WHERE case_id = ?', [req.params.id]);
    await db.query('DELETE FROM disciplinary_cases WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Disciplinary case deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete disciplinary case' });
  }
}

// Add a dated entry to a case's updates log.
async function addUpdate(req, res) {
  try {
    const [[c]] = await db.query('SELECT id FROM disciplinary_cases WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ success: false, message: 'Disciplinary case not found' });
    const { note, update_date } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ success: false, message: 'Update note is required' });
    await db.query(
      'INSERT INTO disciplinary_case_updates (case_id, update_date, note, created_by) VALUES (?, ?, ?, ?)',
      [c.id, update_date || new Date(), note.trim(), req.user.id]
    );
    await db.query('UPDATE disciplinary_cases SET updated_at = NOW() WHERE id = ?', [c.id]);
    res.status(201).json({ success: true, message: 'Update added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add update' });
  }
}

// Attach one or more documents to a case. Files land in the access-controlled
// disciplinary/ upload dir; served only via GET /api/admin/documents/:filename.
async function uploadDocuments(req, res) {
  try {
    const [[c]] = await db.query('SELECT id FROM disciplinary_cases WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ success: false, message: 'Disciplinary case not found' });
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });

    const label = (req.body.label || '').trim() || null;
    for (const file of req.files) {
      await db.query(
        'INSERT INTO disciplinary_case_documents (case_id, label, file_url, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [c.id, label, `/uploads/disciplinary/${file.filename}`, file.originalname, file.size, req.user.id]
      );
    }
    await db.query('UPDATE disciplinary_cases SET updated_at = NOW() WHERE id = ?', [c.id]);
    res.status(201).json({ success: true, message: `${req.files.length} document(s) uploaded` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
}

async function removeDocument(req, res) {
  try {
    const [[doc]] = await db.query(
      'SELECT id FROM disciplinary_case_documents WHERE id = ? AND case_id = ?',
      [req.params.docId, req.params.id]
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    await db.query('DELETE FROM disciplinary_case_documents WHERE id = ?', [doc.id]);
    res.json({ success: true, message: 'Document removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove document' });
  }
}

module.exports = { getAll, getStats, getOne, create, update, remove, addUpdate, uploadDocuments, removeDocument };
