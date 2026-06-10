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
    res.status(500).json({ success: false, message: 'Failed to fetch claims', error: err.message });
  }
}

async function create(req, res) {
  try {
    const { claim_type, description, amount_requested } = req.body;
    if (!claim_type) return res.status(400).json({ success: false, message: 'Claim type required' });

    const claimNumber = await nextSeq('bbf_seq', 'BBF');

    const [result] = await db.query(
      `INSERT INTO bbf_claims (claim_number, member_id, claim_type, description, amount_requested)
       VALUES (?, ?, ?, ?, ?)`,
      [claimNumber, req.member.id, claim_type, description || null, amount_requested || null]
    );
    const [[claim]] = await db.query('SELECT * FROM bbf_claims WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create claim', error: err.message });
  }
}

async function getOne(req, res) {
  try {
    const [[claim]] = await db.query(
      'SELECT * FROM bbf_claims WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const [docs] = await db.query('SELECT * FROM bbf_claim_documents WHERE claim_id = ?', [claim.id]);
    res.json({ success: true, data: { ...claim, documents: docs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claim', error: err.message });
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
    const required = ['tsc_slip', 'burial_permit', 'letter_from_principal'];
    const labels = { tsc_slip: 'TSC Slip', burial_permit: 'Burial Permit', letter_from_principal: 'Letter From Principal' };
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

    await notificationService.createNotification({
      memberId: req.member.id,
      type: 'bbf_claim',
      title: 'BBF Claim Submitted',
      body: `Your claim ${claim.claim_number} has been submitted and is awaiting review.`,
      referenceId: claim.id,
      smsMessage: `Dear member, your BBF claim ${claim.claim_number} has been submitted for review. - KUPPET Migori`,
    });

    res.json({ success: true, message: 'Claim submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit claim', error: err.message });
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
    res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
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
    res.status(500).json({ success: false, message: 'Failed to fetch timeline', error: err.message });
  }
}

module.exports = { getAll, create, getOne, submitClaim, uploadDocuments, getTimeline };
