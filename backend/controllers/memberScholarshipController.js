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

    const [[scholarship]] = await db.query('SELECT id, title FROM scholarships WHERE id = ? AND is_active = 1', [id]);
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

    // Persist the application and its documents atomically — one transaction plus a
    // single multi-row insert for the docs — so a partial failure never leaves an
    // application without its files, and fewer round-trips are held during a rush.
    const conn = await db.getConnection();
    let applicationId;
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO scholarship_applications
           (application_number, member_id, scholarship_id, applicant_name, institution, course, year_of_study, academic_year, essay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appNumber, req.member.id, id, member.full_name, institution || null, course || null,
         year_of_study || null, academic_year || null, essay || null]
      );
      applicationId = result.insertId;
      const docValues = REQUIRED_DOCS.map(({ field }) => {
        const file = files[field][0];
        return [applicationId, field, `/uploads/scholarships/${file.filename}`, file.originalname, file.size];
      });
      await conn.query(
        'INSERT INTO scholarship_application_documents (application_id, doc_type, file_url, file_name, file_size) VALUES ?',
        [docValues]
      );
      // Open the audit trail (mirrors BBF's submit timeline entry). Best-effort:
      // if the timeline table isn't there yet (migration #26 unrun on live), skip
      // it rather than fail the application. ER_NO_SUCH_TABLE won't abort the txn.
      try {
        await conn.query(
          'INSERT INTO scholarship_application_timeline (application_id, from_status, to_status, comment, changed_by, changed_by_type) VALUES (?, NULL, "applied", "Application submitted by member", ?, "member")',
          [applicationId, req.member.id]
        );
      } catch (err) { console.error('[timeline] scholarship submit timeline skipped:', err.message); }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Fire-and-forget: the SMS + SMTP round-trip must not hold the response open —
    // under a scholarship-announcement rush that inline wait dominates per-request
    // latency. The in-app notification/SMS/email still send in the background.
    const msg = notificationService.renderNotification('scholarship_submitted', {
      app_number: appNumber,
      scholarship_title: scholarship.title,
    });
    notificationService.createNotification({
      memberId: req.member.id,
      type: 'scholarship',
      title: msg.title,
      body: msg.body,
      referenceId: applicationId,
      email: true,
      smsMessage: msg.sms,
    }).catch(() => {});

    res.status(201).json({ success: true, message: 'Application submitted successfully', data: { application_number: appNumber } });
  } catch (err) {
    // Race guard: two concurrent submissions can both pass the "already applied" check
    // above and reach the INSERT. The UNIQUE(member_id, scholarship_id) key (migration #17)
    // makes the DB reject the loser here.
    if (err.code === 'ER_DUP_ENTRY' && /uq_member_scholarship/.test(err.message || '')) {
      return res.status(409).json({ success: false, message: 'You have already applied for this scholarship' });
    }
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
    // Attach each application's documents so the member can review/replace them
    // from the list (one extra query, not per-application).
    if (apps.length) {
      const [docs] = await db.query(
        'SELECT * FROM scholarship_application_documents WHERE application_id IN (?)',
        [apps.map(a => a.id)]
      );
      const byApp = {};
      for (const d of docs) (byApp[d.application_id] ||= []).push(d);
      for (const a of apps) a.documents = byApp[a.id] || [];
    }
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
}

// Replace one of the required documents on an application that is still awaiting
// review (status "applied"). Once an admin starts reviewing (or a decision is
// made) the documents lock.
async function reuploadDocument(req, res) {
  try {
    const docType = req.body.doc_type;
    if (!REQUIRED_DOCS.find(d => d.field === docType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const [[app]] = await db.query(
      'SELECT id, status FROM scholarship_applications WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'applied') {
      return res.status(400).json({ success: false, message: 'Documents can only be changed while the application is awaiting review' });
    }

    // Swap the existing document of this type for the new upload.
    await db.query(
      'DELETE FROM scholarship_application_documents WHERE application_id = ? AND doc_type = ?',
      [app.id, docType]
    );
    await db.query(
      'INSERT INTO scholarship_application_documents (application_id, doc_type, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?)',
      [app.id, docType, `/uploads/scholarships/${req.file.filename}`, req.file.originalname, req.file.size]
    );
    res.json({ success: true, message: 'Document replaced' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Re-upload failed' });
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

module.exports = { getAvailable, apply, getApplications, getOneApplication, reuploadDocument };
