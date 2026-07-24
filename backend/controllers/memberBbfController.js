const db = require('../config/database');
const { nextSeq } = require('./memberAuthController');
const notificationService = require('../services/notificationService');

async function getAll(req, res) {
  try {
    const [claims] = await db.query(
      'SELECT * FROM bbf_claims WHERE member_id = ? ORDER BY created_at DESC',
      [req.member.id]
    );
    res.json({ success: true, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
}

async function create(req, res) {
  try {
    const { claim_type, deceased_name, relationship, date_of_death } = req.body;

    if (!claim_type) return res.status(400).json({ success: false, message: 'Claim type required' });
    if (!['death', 'retirement'].includes(claim_type)) {
      return res.status(400).json({ success: false, message: 'Claim type must be death or retirement' });
    }
    if (claim_type === 'death' && (!deceased_name || !relationship || !date_of_death)) {
      return res.status(400).json({ success: false, message: 'Deceased name, relationship and date of death are required for a death claim' });
    }

    // The member's own identifying details (incl. school category) come from their profile — never re-entered.
    const [[m]] = await db.query(
      'SELECT full_name, tsc_number, sub_county, school_name, school_category FROM members WHERE id = ?',
      [req.member.id]
    );
    if (!m) return res.status(404).json({ success: false, message: 'Member profile not found' });
    if (!m.school_category) {
      return res.status(400).json({ success: false, message: 'Please set your school category in your profile before submitting a claim' });
    }

    // For a death claim the "name" is the deceased relative; for retirement it is the member (the retiree).
    const claimName = claim_type === 'death' ? deceased_name : m.full_name;

    const claimNumber = await nextSeq('bbf_seq', 'BBF');

    const [result] = await db.query(
      `INSERT INTO bbf_claims
         (claim_number, member_id, claim_type, deceased_name, tsc_no, sub_county, school, school_category, relationship, date_of_death)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        claimNumber, req.member.id, claim_type,
        claimName, m.tsc_number, m.sub_county, m.school_name,
        m.school_category,
        claim_type === 'death' ? relationship : null,
        claim_type === 'death' ? date_of_death : null,
      ]
    );
    const [[claim]] = await db.query('SELECT * FROM bbf_claims WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create claim' });
  }
}

async function getOne(req, res) {
  try {
    const [[claim]] = await db.query(
      `SELECT bc.*, m.full_name AS applicant_name, m.member_number AS applicant_member_number,
              m.phone AS applicant_phone, m.email AS applicant_email, m.national_id AS applicant_national_id
       FROM bbf_claims bc JOIN members m ON bc.member_id = m.id
       WHERE bc.id = ? AND bc.member_id = ?`,
      [req.params.id, req.member.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const [docs] = await db.query('SELECT * FROM bbf_claim_documents WHERE claim_id = ?', [claim.id]);
    res.json({ success: true, data: { ...claim, documents: docs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
}

async function submitClaim(req, res) {
  try {
    const [[claim]] = await db.query(
      'SELECT * FROM bbf_claims WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (claim.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft claims can be submitted' });

    const [docs] = await db.query(
      'SELECT doc_type FROM bbf_claim_documents WHERE claim_id = ?', [claim.id]
    );
    const uploaded = new Set(docs.map(d => d.doc_type));
    // Required documents differ by claim type: retirement claims need the
    // TSC slip + letter of compulsory retirement; death claims need the
    // TSC slip, burial permit and letter from principal.
    const required = claim.claim_type === 'retirement'
      ? ['tsc_slip', 'letter_of_compulsory_retirement']
      : ['tsc_slip', 'burial_permit', 'letter_from_principal'];
    const labels = {
      tsc_slip: 'TSC Slip',
      burial_permit: 'Burial Permit',
      letter_from_principal: 'Letter From Principal',
      letter_of_compulsory_retirement: 'Letter of Compulsory Retirement',
    };
    const missing = required.filter(t => !uploaded.has(t));
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required documents: ${missing.map(t => labels[t]).join(', ')}` });
    }

    await db.query(
      'UPDATE bbf_claims SET status = "submitted", submitted_at = NOW() WHERE id = ?',
      [claim.id]
    );
    await db.query(
      'INSERT INTO bbf_claim_timeline (claim_id, from_status, to_status, comment, changed_by, changed_by_type) VALUES (?, ?, ?, ?, ?, "member")',
      [claim.id, 'draft', 'submitted', 'Claim submitted by member', req.member.id]
    );

    // Fire-and-forget: the SMS + SMTP round-trip must not hold the response open.
    // The in-app notification/SMS/email still send in the background.
    const msg = notificationService.renderNotification('bbf_submitted', { claim_number: claim.claim_number });
    notificationService.createNotification({
      memberId: req.member.id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      email: true,
      smsMessage: msg.sms,
    }).catch(() => {});

    res.json({ success: true, message: 'Claim submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit claim' });
  }
}

async function uploadDocuments(req, res) {
  try {
    const [[claim]] = await db.query(
      'SELECT id FROM bbf_claims WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });

    const docType = req.body.doc_type || 'other';
    for (const file of req.files) {
      await db.query(
        'INSERT INTO bbf_claim_documents (claim_id, doc_type, file_url, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [claim.id, docType, `/uploads/bbf/${file.filename}`, file.originalname, file.size, req.member.id]
      );
    }
    res.json({ success: true, message: `${req.files.length} document(s) uploaded` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
}

async function getTimeline(req, res) {
  try {
    const [[claim]] = await db.query(
      'SELECT id FROM bbf_claims WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const [timeline] = await db.query(
      'SELECT * FROM bbf_claim_timeline WHERE claim_id = ? ORDER BY created_at ASC',
      [claim.id]
    );
    res.json({ success: true, data: timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch timeline' });
  }
}

module.exports = { getAll, create, getOne, submitClaim, uploadDocuments, getTimeline };
