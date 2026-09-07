const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');
const { sendXlsx } = require('../utils/excel');
const notificationService = require('../services/notificationService');
const { nextSeq } = require('./memberAuthController');
const { removeUploadedFiles } = require('../utils/uploads');

const VALID_TRANSITIONS = {
  submitted:    ['under_review'],
  under_review: ['approved', 'rejected'],
  approved:     ['paid'],
};

// Document slots for an admin-filed death-of-member claim. Mirrors
// BBF_DOC_SLOTS.death in memberBbfController — the first three are required.
const DEATH_DOC_SLOTS = [
  { type: 'tsc_slip',           label: 'TSC Slip',           required: true },
  { type: 'burial_permit',      label: 'Burial Permit',      required: true },
  { type: 'bbf_claim_form',     label: 'BBF Claim Form',     required: true },
  { type: 'birth_notification', label: 'Birth Notification', required: false },
];

// A death claim records a past event; a future date is a typo or a bad client.
function dodError(date_of_death) {
  if (!date_of_death) return 'Date of death is required';
  const dod = new Date(date_of_death);
  if (Number.isNaN(dod.getTime())) return 'Date of death is not a valid date';
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (dod > endOfToday) return 'Date of death cannot be in the future';
  return null;
}

// Recipient overrides so a death-of-member claim's status notifications reach the
// next of kin instead of the deceased member's own (defunct) phone/email. Returns
// {} for a normal member-filed claim, leaving createNotification's default
// (notify the member). Spread this into the notifySafely payload.
function nokTarget(claim) {
  if (!claim || !claim.deceased_is_member) return {};
  return {
    smsPhone: claim.next_of_kin_phone || null,
    emailTo: claim.next_of_kin_email || null,
    recipientName: claim.next_of_kin_name || null,
    email: !!claim.next_of_kin_email,
  };
}

// Thrown when a conditional status UPDATE matches no rows: another admin (or a
// double-submitted click) already moved the claim on between our SELECT and our
// UPDATE. Surfaces as a 409 so the admin reloads instead of seeing a bare 500.
class StaleClaim extends Error {
  constructor() { super('This claim was just updated by someone else. Reload the page and try again.'); }
}

// Runs on the pool by default, or on a supplied connection when the caller is
// wrapping the status change + timeline row in one transaction.
async function addTimeline(claimId, fromStatus, toStatus, comment, adminId, conn = db) {
  await conn.query(
    'INSERT INTO bbf_claim_timeline (claim_id, from_status, to_status, comment, changed_by, changed_by_type) VALUES (?, ?, ?, ?, ?, "admin")',
    [claimId, fromStatus, toStatus, comment || null, adminId]
  );
}

// Member notifications are best-effort: the status change is already committed,
// so a notification-delivery failure must not make the API report a failure the
// admin would (wrongly) retry.
async function notifySafely(payload) {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error('[notify] BBF notification failed for member', payload.memberId, '-', err.message);
  }
}

// Build the claims filter once (status, search) so the list, its count and the
// Excel export all stay in sync. Returns { where, params }.
function buildBbfFilter({ status, search, school_category, sub_county, school, gender, has_disability, claim_type, date_from, date_to } = {}) {
  // Drafts are a member's unsubmitted work-in-progress — they never appear in the
  // admin queue (list, count or export), regardless of any status filter passed.
  let where = "WHERE bc.status <> 'draft'";
  const params = [];
  if (status) { where += ' AND bc.status = ?'; params.push(status); }
  if (claim_type) { where += ' AND bc.claim_type = ?'; params.push(claim_type); }
  if (school_category) { where += ' AND m.school_category = ?'; params.push(school_category); }
  if (sub_county) { where += ' AND m.sub_county = ?'; params.push(sub_county); }
  if (school) { where += ' AND m.school_name LIKE ?'; params.push(`%${school}%`); }
  if (gender) { where += ' AND m.gender = ?'; params.push(gender); }
  // Person With Disability — '1' (yes) / '0' (no); any other value means "all".
  if (has_disability === '1' || has_disability === '0') { where += ' AND m.has_disability = ?'; params.push(has_disability); }
  // Date range on the submitted date (the "Submitted" column). Inclusive; either
  // bound is optional, so a single date, a month or a whole year can be selected.
  if (date_from) { where += ' AND DATE(bc.submitted_at) >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND DATE(bc.submitted_at) <= ?'; params.push(date_to); }
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

// Admin files a death-benefit claim on behalf of a member who has died. The
// deceased IS the member, so the identity snapshot (name, TSC, sub-county,
// school, category) is taken from the member's own row — never re-keyed — and a
// next of kin is recorded as the claimant. The claim is created complete
// (documents attached) and lands straight at `submitted`; the member's account
// is flagged deceased in the same transaction, and the submitted-notification
// goes to the next of kin, not the deceased member.
async function createForMember(req, res) {
  // Any reject path must discard the files multer already wrote. Only ever
  // called before the commit below, so it can never delete a stored file.
  const reject = async (status, message) => {
    await removeUploadedFiles(req);
    return res.status(status).json({ success: false, message });
  };
  try {
    const {
      member_id, date_of_death, amount_requested,
      next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, next_of_kin_email,
    } = req.body;

    const dodErr = dodError(date_of_death);
    if (dodErr) return reject(400, dodErr);

    const [[m]] = await db.query(
      'SELECT id, full_name, tsc_number, sub_county, school_name, school_category FROM members WHERE id = ?',
      [member_id]
    );
    if (!m) return reject(404, 'Member not found');
    if (!m.school_category) {
      return reject(400, "This member has no school category set — set it on their profile before filing a claim.");
    }

    // One death-of-member claim per member (a rejected one may be refiled).
    const [[existing]] = await db.query(
      "SELECT id FROM bbf_claims WHERE member_id = ? AND deceased_is_member = 1 AND status <> 'rejected'",
      [member_id]
    );
    if (existing) return reject(409, 'A death claim for this member is already on file.');

    // Required documents must all be present — parity with the member submit flow.
    const files = req.files || {};
    const missing = DEATH_DOC_SLOTS.filter(s => s.required && !(files[s.type] && files[s.type].length));
    if (missing.length) {
      return reject(400, `Missing required documents: ${missing.map(s => s.label).join(', ')}`);
    }

    const claimNumber = await nextSeq('bbf_seq', 'BBF');
    // Rendered before the transaction so nothing that can throw runs after commit.
    const msg = notificationService.renderNotification('bbf_submitted', { claim_number: claimNumber });

    let claimId;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO bbf_claims
           (claim_number, member_id, claim_type, deceased_is_member, deceased_name, tsc_no, sub_county, school,
            school_category, date_of_death, amount_requested, next_of_kin_name, next_of_kin_relationship,
            next_of_kin_phone, next_of_kin_email, filed_by, status, submitted_at)
         VALUES (?, ?, 'death', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())`,
        [claimNumber, m.id, m.full_name, m.tsc_number, m.sub_county, m.school_name, m.school_category,
         date_of_death, amount_requested || null, next_of_kin_name, next_of_kin_relationship || null,
         next_of_kin_phone, next_of_kin_email || null, req.user.id]
      );
      claimId = result.insertId;

      for (const slot of DEATH_DOC_SLOTS) {
        const arr = files[slot.type];
        if (arr && arr.length) {
          const f = arr[0];
          await conn.query(
            'INSERT INTO bbf_claim_documents (claim_id, doc_type, file_url, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
            [claimId, slot.type, `/uploads/bbf/${f.filename}`, f.originalname, f.size, req.user.id]
          );
        }
      }

      await addTimeline(claimId, null, 'submitted', 'Claim filed by admin on behalf of the deceased member', req.user.id, conn);
      // Flag the account: the member has died — blocks login, excludes from active workflows.
      await conn.query('UPDATE members SET is_deceased = 1 WHERE id = ?', [m.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Committed — notify the next of kin (never the deceased member).
    await notifySafely({
      memberId: m.id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claimId,
      adminId: req.user.id,
      smsMessage: msg.sms,
      smsPhone: next_of_kin_phone,
      emailTo: next_of_kin_email || null,
      recipientName: next_of_kin_name,
      email: !!next_of_kin_email,
    });

    res.status(201).json({ success: true, message: `Claim ${claimNumber} filed`, claim_number: claimNumber, id: claimId });
  } catch (err) {
    console.error('BBF admin create failed:', err);
    return reject(500, 'Failed to file claim');
  }
}

async function startReview(req, res) {
  try {
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number, deceased_is_member, next_of_kin_name, next_of_kin_phone, next_of_kin_email FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!VALID_TRANSITIONS[claim.status]?.includes('under_review')) {
      return res.status(400).json({ success: false, message: `Cannot move from ${claim.status} to under_review` });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('UPDATE bbf_claims SET status = "under_review", assigned_to = ?, reviewed_at = NOW() WHERE id = ? AND status = ?', [req.user.id, claim.id, claim.status]);
      if (!r.affectedRows) throw new StaleClaim();
      await addTimeline(claim.id, claim.status, 'under_review', req.body.notes, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('bbf_under_review', { claim_number: claim.claim_number });
    await notifySafely({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
      // Route to the next of kin when this is a death-of-member claim; no-op otherwise.
      ...nokTarget(claim),
    });
    res.json({ success: true, message: 'Claim marked under review' });
  } catch (err) {
    if (err instanceof StaleClaim) return res.status(409).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
}

async function approveClaim(req, res) {
  try {
    const { amount, notes } = req.body;
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number, deceased_is_member, next_of_kin_name, next_of_kin_phone, next_of_kin_email FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!VALID_TRANSITIONS[claim.status]?.includes('approved')) {
      return res.status(400).json({ success: false, message: `Cannot approve from status ${claim.status}` });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [upd] = await conn.query(
        'UPDATE bbf_claims SET status = "approved", amount_approved = ?, reviewed_by = ?, reviewer_notes = ?, resolved_at = NOW() WHERE id = ? AND status = ?',
        [amount || null, req.user.id, notes || null, claim.id, claim.status]
      );
      if (!upd.affectedRows) throw new StaleClaim();
      await addTimeline(claim.id, claim.status, 'approved', notes, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('bbf_approved', {
      claim_number: claim.claim_number,
      amount: amount ? Number(amount).toLocaleString() : '',
    });
    await notifySafely({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
      // Route to the next of kin when this is a death-of-member claim; no-op otherwise.
      ...nokTarget(claim),
    });
    res.json({ success: true, message: 'Claim approved' });
  } catch (err) {
    if (err instanceof StaleClaim) return res.status(409).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: 'Failed to approve' });
  }
}

async function rejectClaim(req, res) {
  try {
    const { notes } = req.body;
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number, deceased_is_member, next_of_kin_name, next_of_kin_phone, next_of_kin_email FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (!VALID_TRANSITIONS[claim.status]?.includes('rejected')) {
      return res.status(400).json({ success: false, message: `Cannot reject from status ${claim.status}` });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [upd] = await conn.query(
        'UPDATE bbf_claims SET status = "rejected", reviewed_by = ?, reviewer_notes = ?, resolved_at = NOW() WHERE id = ? AND status = ?',
        [req.user.id, notes || null, claim.id, claim.status]
      );
      if (!upd.affectedRows) throw new StaleClaim();
      await addTimeline(claim.id, claim.status, 'rejected', notes, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('bbf_rejected', {
      claim_number: claim.claim_number,
      reason: notes || '',
    });
    await notifySafely({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
      // Route to the next of kin when this is a death-of-member claim; no-op otherwise.
      ...nokTarget(claim),
    });
    res.json({ success: true, message: 'Claim rejected' });
  } catch (err) {
    if (err instanceof StaleClaim) return res.status(409).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: 'Failed to reject' });
  }
}

async function markPaid(req, res) {
  try {
    const { ref } = req.body;
    const [[claim]] = await db.query('SELECT id, status, member_id, claim_number, deceased_is_member, next_of_kin_name, next_of_kin_phone, next_of_kin_email FROM bbf_claims WHERE id = ?', [req.params.id]);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (claim.status !== 'approved') return res.status(400).json({ success: false, message: 'Only approved claims can be marked paid' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [upd] = await conn.query(
        'UPDATE bbf_claims SET status = "paid", payment_reference = ?, payment_date = CURDATE() WHERE id = ? AND status = "approved"',
        [ref || null, claim.id]
      );
      if (!upd.affectedRows) throw new StaleClaim();
      await addTimeline(claim.id, 'approved', 'paid', `Payment reference: ${ref || 'N/A'}`, req.user.id, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const msg = notificationService.renderNotification('bbf_paid', {
      claim_number: claim.claim_number,
      reference: ref || '',
    });
    await notifySafely({
      memberId: claim.member_id,
      type: 'bbf_claim',
      title: msg.title,
      body: msg.body,
      referenceId: claim.id,
      adminId: req.user.id,
      email: true,
      smsMessage: msg.sms,
      // Route to the next of kin when this is a death-of-member claim; no-op otherwise.
      ...nokTarget(claim),
    });
    res.json({ success: true, message: 'Claim marked as paid' });
  } catch (err) {
    if (err instanceof StaleClaim) return res.status(409).json({ success: false, message: err.message });
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

module.exports = { getAll, getOne, createForMember, startReview, approveClaim, rejectClaim, markPaid, exportExcel };
