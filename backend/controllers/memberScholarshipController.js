const db = require('../config/database');
const { nextSeq } = require('./memberAuthController');
const notificationService = require('../services/notificationService');

async function getAvailable(req, res) {
  try {
    const [scholarships] = await db.query(
      'SELECT * FROM scholarships WHERE is_active = 1 ORDER BY is_featured DESC, application_deadline ASC'
    );
    res.json({ success: true, data: scholarships });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch scholarships' });
  }
}

// Required document slots. The member uploads exactly these two (both mandatory);
// req.files is keyed by these field names (multer .fields()).
const REQUIRED_DOCS = [
  { field: 'letter_of_application', label: 'Letter of Application' },
  { field: 'tsc_slip',             label: 'TSC Slip' },
];

async function apply(req, res) {
  try {
    const id = req.params.id;

    const [[scholarship]] = await db.query('SELECT * FROM scholarships WHERE id = ? AND is_active = 1', [id]);
    if (!scholarship) return res.status(404).json({ success: false, message: 'Scholarship not found' });

    const [[existing]] = await db.query(
      'SELECT id FROM scholarship_applications WHERE member_id = ? AND scholarship_id = ?',
      [req.member.id, id]
    );
    if (existing) return res.status(409).json({ success: false, message: 'You have already applied for this scholarship' });

    // The applicant is the logged-in member (scholarships fund members' own studies) —
    // identity comes from their account, never re-entered on the form.
    const [[member]] = await db.query('SELECT full_name FROM members WHERE id = ?', [req.member.id]);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });

    // Both required documents must be present.
    const files = req.files || {};
    const missing = REQUIRED_DOCS.filter(d => !files[d.field]?.[0]);
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required documents: ${missing.map(d => d.label).join(', ')}` });
    }

    const { institution, course, year_of_study, academic_year, essay } = req.body;
    const appNumber = await nextSeq('schapp_seq', 'SAPP');

    const [result] = await db.query(
      `INSERT INTO scholarship_applications
         (application_number, member_id, scholarship_id, applicant_name, institution, course, year_of_study, academic_year, essay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [appNumber, req.member.id, id, member.full_name, institution || null, course || null,
       year_of_study || null, academic_year || null, essay || null]
    );

    for (const { field } of REQUIRED_DOCS) {
      const file = files[field][0];
      await db.query(
        'INSERT INTO scholarship_application_documents (application_id, doc_type, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?)',
        [result.insertId, field, `/uploads/scholarships/${file.filename}`, file.originalname, file.size]
      );
    }

    await notificationService.createNotification({
      memberId: req.member.id,
      type: 'scholarship',
      title: 'Scholarship Application Submitted',
      body: `Your application ${appNumber} for "${scholarship.title}" has been submitted and is awaiting review.`,
      referenceId: result.insertId,
      smsMessage: `Dear member, your scholarship application ${appNumber} has been submitted for review. - KUPPET Migori`,
    });

    res.status(201).json({ success: true, message: 'Application submitted successfully', data: { application_number: appNumber } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Application failed' });
  }
}

async function getApplications(req, res) {
  try {
    const [apps] = await db.query(
      `SELECT sa.*, s.title as scholarship_title, s.provider
       FROM scholarship_applications sa
       JOIN scholarships s ON sa.scholarship_id = s.id
       WHERE sa.member_id = ?
       ORDER BY sa.created_at DESC`,
      [req.member.id]
    );
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
}

async function getOneApplication(req, res) {
  try {
    const [[app]] = await db.query(
      `SELECT sa.*, s.title as scholarship_title, s.provider, s.description as scholarship_desc
       FROM scholarship_applications sa
       JOIN scholarships s ON sa.scholarship_id = s.id
       WHERE sa.id = ? AND sa.member_id = ?`,
      [req.params.id, req.member.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    const [docs] = await db.query('SELECT * FROM scholarship_application_documents WHERE application_id = ?', [app.id]);
    res.json({ success: true, data: { ...app, documents: docs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch application' });
  }
}

module.exports = { getAvailable, apply, getApplications, getOneApplication };
