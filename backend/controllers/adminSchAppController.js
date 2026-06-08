const db = require('../config/database');
const notificationService = require('../services/notificationService');

async function getAll(req, res) {
  try {
    const { status, scholarship_id, limit = 25, offset = 0 } = req.query;
    let query = `SELECT sa.*, m.full_name, m.member_number, s.title as scholarship_title
                 FROM scholarship_applications sa
                 JOIN members m ON sa.member_id = m.id
                 JOIN scholarships s ON sa.scholarship_id = s.id WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND sa.status = ?'; params.push(status); }
    if (scholarship_id) { query += ' AND sa.scholarship_id = ?'; params.push(scholarship_id); }
    query += ' ORDER BY sa.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications', error: err.message });
  }
}

async function getOne(req, res) {
  try {
    const [[app]] = await db.query(
      `SELECT sa.*, m.full_name, m.member_number, m.phone, m.email, s.title as scholarship_title
       FROM scholarship_applications sa
       JOIN members m ON sa.member_id = m.id
       JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?`,
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    const [docs] = await db.query('SELECT * FROM scholarship_application_documents WHERE application_id = ?', [app.id]);
    res.json({ success: true, data: { ...app, documents: docs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch', error: err.message });
  }
}

async function approve(req, res) {
  try {
    const { notes } = req.body;
    const [[app]] = await db.query(
      'SELECT sa.*, s.title FROM scholarship_applications sa JOIN scholarships s ON sa.scholarship_id = s.id WHERE sa.id = ?',
      [req.params.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    await db.query(
      'UPDATE scholarship_applications SET status = "approved", reviewed_by = ?, reviewer_notes = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.id, notes || null, app.id]
    );
    await notificationService.createNotification({
      memberId: app.member_id,
      type: 'scholarship',
      title: 'Scholarship Application Approved',
      body: `Your scholarship application for "${app.title}" (${app.applicant_name}) has been approved.`,
      referenceId: app.id,
      adminId: req.user.id,
      smsMessage: `Dear member, the scholarship application for ${app.applicant_name} (${app.title}) has been APPROVED. - KUPPET Migori`,
    });
    res.json({ success: true, message: 'Application approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve', error: err.message });
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
    await notificationService.createNotification({
      memberId: app.member_id,
      type: 'scholarship',
      title: 'Scholarship Application Unsuccessful',
      body: `Your scholarship application for "${app.title}" (${app.applicant_name}) was not successful this time.`,
      referenceId: app.id,
      adminId: req.user.id,
    });
    res.json({ success: true, message: 'Application rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject', error: err.message });
  }
}

module.exports = { getAll, getOne, approve, reject };
