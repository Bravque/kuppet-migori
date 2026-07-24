const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');
const { sendXlsx } = require('../utils/excel');
const notificationService = require('../services/notificationService');

const VALID_TRANSITIONS = {
  submitted:    ['under_review'],
  under_review: ['approved', 'rejected'],
  approved:     ['paid'],
};

async function addTimeline(claimId, fromStatus, toStatus, comment, adminId) {
  await db.query(
    'INSERT INTO bbf_claim_timeline (claim_id, from_status, to_status, comment, changed_by, changed_by_type) VALUES (?, ?, ?, ?, ?, "admin")',
    [claimId, fromStatus, toStatus, comment || null, adminId]
  );
}

// Build the claims filter once (status, search) so the list, its count and the
// Excel export all stay in sync. Returns { where, params }.
function buildBbfFilter({ status, search } = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND bc.status = ?'; params.push(status); }
  if (search) { where += ' AND (bc.claim_number LIKE ? OR m.full_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  return { where, params };
}

async function getAll(req, res) {
  try {
    const { limit = 25, offset = 0 } = req.query;
    const { where, params: filterParams } = buildBbfFilter(req.query);

    const [rows] = await db.query(
      `SELECT bc.*, m.full_name, m.member_number, m.phone
       FROM bbf_claims bc JOIN members m ON bc.member_id = m.id ${where}
       ORDER BY bc.created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, clampLimit(limit, 25), clampOffset(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM bbf_claims bc JOIN members m ON bc.member_id = m.id ${where}`,
      filterParams
    );
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
}

async function getOne(req, res) {
  try {
    const [[claim]] = await db.query(
      `SELECT bc.*, m.full_name, m.member_number, m.phone, m.email
       FROM bbf_claims bc JOIN members m ON bc.member_id = m.id WHERE bc.id = ?`,
      [req.params.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const [docs] = await db.query('SELECT * FROM bbf_claim_documents WHERE claim_id = ?', [claim.id]);
    const [timeline] = await db.query('SELECT * FROM bbf_claim_timeline WHERE claim_id = ? ORDER BY created_at ASC', [claim.id]);
    res.json({ success: true, data: { ...claim, documents: docs, timeline } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
}

async function startReview(req, res) {
  try {
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!VALID_TRANSITIONS[claim.status]?.includes('under_review')) {
      return res.status(400).json({ success: false, message: `Cannot move from ${claim.status} to under_review` });
    }
    await db.query('UPDATE bbf_claims SET status = "under_review", assigned_to = ?, reviewed_at = NOW() WHERE id = ?', [req.user.id, claim.id]);
    await addTimeline(claim.id, claim.status, 'under_review', req.body.notes, req.user.id);
    const msg = notificationService.renderNotification('bbf_under_review', { claim_number: claim.claim_number });
    await notificationService.createNotification({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Claim marked under review' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
}

async function approveClaim(req, res) {
  try {
    const { amount, notes } = req.body;
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!VALID_TRANSITIONS[claim.status]?.includes('approved')) {
      return res.status(400).json({ success: false, message: `Cannot approve from status ${claim.status}` });
    }
    await db.query(
      'UPDATE bbf_claims SET status = "approved", amount_approved = ?, reviewed_by = ?, reviewer_notes = ?, resolved_at = NOW() WHERE id = ?',
      [amount || null, req.user.id, notes || null, claim.id]
    );
    await addTimeline(claim.id, claim.status, 'approved', notes, req.user.id);
    const msg = notificationService.renderNotification('bbf_approved', {
      claim_number: claim.claim_number,
      amount: amount ? Number(amount).toLocaleString() : '',
    });
    await notificationService.createNotification({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Claim approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve' });
  }
}

async function rejectClaim(req, res) {
  try {
    const { notes } = req.body;
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    await db.query(
      'UPDATE bbf_claims SET status = "rejected", reviewed_by = ?, reviewer_notes = ?, resolved_at = NOW() WHERE id = ?',
      [req.user.id, notes || null, claim.id]
    );
    await addTimeline(claim.id, claim.status, 'rejected', notes, req.user.id);
    const msg = notificationService.renderNotification('bbf_rejected', {
      claim_number: claim.claim_number,
      reason: notes || '',
    });
    await notificationService.createNotification({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Claim rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject' });
  }
}

async function markPaid(req, res) {
  try {
    const { ref } = req.body;
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (claim.status !== 'approved') return res.status(400).json({ success: false, message: 'Only approved claims can be marked paid' });
    await db.query(
      'UPDATE bbf_claims SET status = "paid", payment_reference = ?, payment_date = CURDATE() WHERE id = ?',
      [ref || null, claim.id]
    );
    await addTimeline(claim.id, 'approved', 'paid', `Payment reference: ${ref || 'N/A'}`, req.user.id);
    const msg = notificationService.renderNotification('bbf_paid', {
      claim_number: claim.claim_number,
      reference: ref || '',
    });
    await notificationService.createNotification({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
    });
    res.json({ success: true, message: 'Claim marked as paid' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark paid' });
  }
}

async function exportExcel(req, res) {
  try {
    // Honour the same filters the list is showing (status, search).
    const { where, params } = buildBbfFilter(req.query);
    const [rows] = await db.query(
      `SELECT bc.claim_number, m.full_name, m.member_number, bc.claim_type,
              bc.deceased_name, bc.tsc_no, bc.sub_county, bc.school, bc.school_category,
              bc.relationship, DATE(bc.date_of_death) as date_of_death, bc.status,
              bc.amount_approved, DATE(bc.submitted_at) as submitted,
              DATE(bc.resolved_at) as resolved
       FROM bbf_claims bc JOIN members m ON bc.member_id = m.id ${where} ORDER BY bc.created_at DESC`,
      params
    );
    await sendXlsx(res, { sheetName: 'BBF Claims', filename: 'bbf-claims.xlsx', rows });
  } catch (err) {
    console.error('BBF export failed:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}

module.exports = { getAll, getOne, startReview, approveClaim, rejectClaim, markPaid, exportExcel };
