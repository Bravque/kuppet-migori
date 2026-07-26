const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');
const { sendXlsx } = require('../utils/excel');
const notificationService = require('../services/notificationService');

// A decision (approve/reject) may only act on an application that is still
// awaiting a decision. Prevents re-approving a rejected app, flipping a paid
// one back to approved, etc. (state-machine guard).
const DECIDABLE = ['applied', 'under_review'];

// Member notifications are best-effort: the decision is already committed, so a
// notification-delivery failure must not roll it back or make the API report a
// failure the admin would (wrongly) retry.
async function notifySafely(payload) {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error('[notify] scholarship notification failed for member', payload.memberId, '-', err.message);
  }
}

// Append a status-change row to the application's audit trail (mirrors BBF's
// addTimeline). Best-effort: the timeline is an audit convenience, so a write
// failure (e.g. migration #26 not yet run on live) is logged but never breaks
// the status change it accompanies. ER_NO_SUCH_TABLE doesn't abort the InnoDB
// transaction, so the enclosing commit still persists the status update.
async function addTimeline(applicationId, fromStatus, toStatus, comment, adminId, conn = db) {
  try {
    await conn.query(
      'INSERT INTO scholarship_application_timeline (application_id, from_status, to_status, comment, changed_by, changed_by_type) VALUES (?, ?, ?, ?, ?, "admin")',
      [applicationId, fromStatus, toStatus, comment || null, adminId]
    );
  } catch (err) {
    console.error('[timeline] scholarship timeline write skipped:', err.message);
  }
}

const SCH_BASE = `FROM scholarship_applications sa
                  JOIN members m ON sa.member_id = m.id
                  JOIN scholarships s ON sa.scholarship_id = s.id`;

// Build the applications filter once (status, scholarship, applicant filters) so
// the list, its count and the Excel export all stay in sync. Returns { where, params }.
function buildSchFilter({ status, scholarship_id, scholarship_type, school_category, sub_county, school, gender, date_from, date_to } = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND sa.status = ?'; params.push(status); }
  if (scholarship_id) { where += ' AND sa.scholarship_id = ?'; params.push(scholarship_id); }
  if (scholarship_type) { where += ' AND s.scholarship_type = ?'; params.push(scholarship_type); }
  if (school_category) { where += ' AND m.school_category = ?'; params.push(school_category); }
  if (sub_county) { where += ' AND m.sub_county = ?'; params.push(sub_county); }
  if (school) { where += ' AND m.school_name LIKE ?'; params.push(`%${school}%`); }
  if (gender) { where += ' AND m.gender = ?'; params.push(gender); }
  // Date range on the applied date (the "Applied" column). Inclusive; either
  // bound is optional, so a single day, a month or a whole year can be selected.
  if (date_from) { where += ' AND DATE(sa.created_at) >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND DATE(sa.created_at) <= ?'; params.push(date_to); }
  return { where, params };
}

async function getAll(req, res) {
  try {
    const { limit = 25, offset = 0 } = req.query;
    const { where, params: filterParams } = buildSchFilter(req.query);

    const [rows] = await db.query(
      `SELECT sa.*, m.full_name, m.member_number, s.title as scholarship_title ${SCH_BASE} ${where}
       ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, clampLimit(limit, 25), clampOffset(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${SCH_BASE} ${where}`, filterParams);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
}

async function exportExcel(req, res) {
  try {
    // Honour the same filters the list is showing (status, scholarship, applicant filters).
    const { where, params } = buildSchFilter(req.query);
    const [rows] = await db.query(
      `SELECT sa.application_number, m.full_name, m.member_number, m.tsc_number,
              s.title as scholarship_title, sa.applicant_name,
              m.sub_county, m.school_name, m.school_category, m.gender,
              sa.status, sa.amount_awarded, sa.payment_reference,
              DATE(sa.payment_date) as payment_date,
              DATE(sa.created_at) as applied, DATE(sa.reviewed_at) as reviewed
       ${SCH_BASE} ${where} ORDER BY sa.created_at DESC`,
      params
    );
    await sendXlsx(res, { sheetName: 'Scholarship Applications', filename: 'scholarship-applications.xlsx', rows });
  } catch (err) {
    console.error('Scholarship export failed:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}

async function getOne(req, res) {
  try {
    const [[app]] = await db.query(
      `SELECT sa.*, m.full_name, m.member_number, m.phone, m.email,
              m.tsc_number, m.sub_county, m.school_name, m.school_category, s.title as scholarship_title
       FROM scholarship_applications sa
       JOIN members m ON sa.member_id = m.id
       JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?`,
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    const [docs] = await db.query('SELECT * FROM scholarship_application_documents WHERE application_id = ?', [app.id]);
    let timeline = [];
    try {
      [timeline] = await db.query('SELECT * FROM scholarship_application_timeline WHERE application_id = ? ORDER BY created_at ASC', [app.id]);
    } catch (err) { /* timeline table may not exist yet (migration #26) — non-fatal */ }
    res.json({ success: true, data: { ...app, documents: docs, timeline } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch' });
  }
}

// Move an application into "under review" (mirrors BBF startReview). Available to
// every admin role — only the final approve/reject decision is restricted.
async function startReview(req, res) {
  try {
    const [[app]] = await db.query(
      'SELECT sa.*, s.title FROM scholarship_applications sa JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?',
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'applied') {
      return res.status(400).json({ success: false, message: `Cannot start review from status "${app.status}"` });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE scholarship_applications SET status = "under_review" WHERE id = ?', [app.id]);
      await addTimeline(app.id, app.status, 'under_review', req.body.notes, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('scholarship_under_review', {
      scholarship_title: app.title,
      applicant_name: app.applicant_name,
    });
    await notifySafely({
      memberId: app.member_id,
      type: 'scholarship',
      title: msg.title,
      body: msg.body,
      referenceId: app.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Application marked under review' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
}

async function approve(req, res) {
  try {
    const { notes, amount } = req.body;
    const awarded = (amount === undefined || amount === null || amount === '') ? null : Number(amount);
    const [[app]] = await db.query(
      'SELECT sa.*, s.title FROM scholarship_applications sa JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?',
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (!DECIDABLE.includes(app.status)) {
      return res.status(400).json({ success: false, message: `Cannot approve an application with status "${app.status}"` });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE scholarship_applications SET status = "approved", amount_awarded = ?, reviewed_by = ?, reviewer_notes = ?, reviewed_at = NOW() WHERE id = ?',
        [awarded, req.user.id, notes || null, app.id]
      );
      await addTimeline(app.id, app.status, 'approved', notes, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('scholarship_approved', {
      scholarship_title: app.title,
      applicant_name: app.applicant_name,
      amount: awarded ? Number(awarded).toLocaleString() : '',
    });
    await notifySafely({
      memberId: app.member_id,
      type: 'scholarship',
      title: msg.title,
      body: msg.body,
      referenceId: app.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Application approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve' });
  }
}

async function reject(req, res) {
  try {
    const { notes } = req.body;
    const [[app]] = await db.query(
      'SELECT sa.*, s.title FROM scholarship_applications sa JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?',
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (!DECIDABLE.includes(app.status)) {
      return res.status(400).json({ success: false, message: `Cannot reject an application with status "${app.status}"` });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE scholarship_applications SET status = "rejected", reviewed_by = ?, reviewer_notes = ?, reviewed_at = NOW() WHERE id = ?',
        [req.user.id, notes || null, app.id]
      );
      await addTimeline(app.id, app.status, 'rejected', notes, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('scholarship_rejected', {
      scholarship_title: app.title,
      applicant_name: app.applicant_name,
      reason: notes || '',
    });
    await notifySafely({
      memberId: app.member_id,
      type: 'scholarship',
      title: msg.title,
      body: msg.body,
      referenceId: app.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Application rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject' });
  }
}

// Mark an approved scholarship application as paid (mirrors BBF markPaid).
async function markPaid(req, res) {
  try {
    const { ref } = req.body;
    const [[app]] = await db.query(
      'SELECT sa.*, s.title FROM scholarship_applications sa JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?',
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'approved') return res.status(400).json({ success: false, message: 'Only approved applications can be marked paid' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE scholarship_applications SET status = "paid", payment_reference = ?, payment_date = CURDATE() WHERE id = ?',
        [ref || null, app.id]
      );
      await addTimeline(app.id, 'approved', 'paid', `Payment reference: ${ref || 'N/A'}`, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('scholarship_paid', {
      scholarship_title: app.title,
      applicant_name: app.applicant_name,
      amount: app.amount_awarded ? Number(app.amount_awarded).toLocaleString() : '',
      reference: ref || '',
    });
    await notifySafely({
      memberId: app.member_id,
      type: 'scholarship',
      title: msg.title,
      body: msg.body,
      referenceId: app.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Application marked as paid' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark paid' });
  }
}

module.exports = { getAll, getOne, startReview, approve, reject, markPaid, exportExcel };
