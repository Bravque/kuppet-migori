const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');
const notificationService = require('../services/notificationService');

async function getAll(req, res) {
  try {
    const { status, scholarship_id, school_category, sub_county, school, gender, limit = 25, offset = 0 } = req.query;
    const base = `FROM scholarship_applications sa
                  JOIN members m ON sa.member_id = m.id
                  JOIN scholarships s ON sa.scholarship_id = s.id`;
    let where = 'WHERE 1=1';
    const filterParams = [];
    if (status) { where += ' AND sa.status = ?'; filterParams.push(status); }
    if (scholarship_id) { where += ' AND sa.scholarship_id = ?'; filterParams.push(scholarship_id); }
    if (school_category) { where += ' AND m.school_category = ?'; filterParams.push(school_category); }
    if (sub_county) { where += ' AND m.sub_county = ?'; filterParams.push(sub_county); }
    if (school) { where += ' AND m.school_name LIKE ?'; filterParams.push(`%${school}%`); }
    if (gender) { where += ' AND m.gender = ?'; filterParams.push(gender); }

    const [rows] = await db.query(
      `SELECT sa.*, m.full_name, m.member_number, s.title as scholarship_title ${base} ${where}
       ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, clampLimit(limit, 25), clampOffset(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${base} ${where}`, filterParams);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
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
    res.json({ success: true, data: { ...app, documents: docs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch' });
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
    await db.query(
      'UPDATE scholarship_applications SET status = "approved", amount_awarded = ?, reviewed_by = ?, reviewer_notes = ?, reviewed_at = NOW() WHERE id = ?',
      [awarded, req.user.id, notes || null, app.id]
    );
    const msg = notificationService.renderNotification('scholarship_approved', {
      scholarship_title: app.title,
      applicant_name: app.applicant_name,
      amount: awarded ? Number(awarded).toLocaleString() : '',
    });
    await notificationService.createNotification({
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
    await db.query(
      'UPDATE scholarship_applications SET status = "rejected", reviewed_by = ?, reviewer_notes = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.id, notes || null, app.id]
    );
    const msg = notificationService.renderNotification('scholarship_rejected', {
      scholarship_title: app.title,
      applicant_name: app.applicant_name,
      reason: notes || '',
    });
    await notificationService.createNotification({
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

module.exports = { getAll, getOne, approve, reject };
