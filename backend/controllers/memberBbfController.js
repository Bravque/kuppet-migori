const db = require('../config/database');
const { nextSeq } = require('./memberAuthController');
const notificationService = require('../services/notificationService');
const { removeUploadedFiles, removeStoredFile } = require('../utils/uploads');

// The document slots a claim can carry, per claim type — the single source of
// truth for both "which types may be uploaded" and "which are required to
// submit". Mirrors BBF_DOC_SLOTS_DEATH / _RETIREMENT in member-portal.js.
const BBF_DOC_SLOTS = {
  death: [
    { type: 'tsc_slip',             label: 'TSC Slip',             required: true },
    { type: 'burial_permit',        label: 'Burial Permit',        required: true },
    { type: 'letter_from_principal', label: 'Letter From Principal', required: true },
    { type: 'birth_notification',   label: 'Birth Notification',   required: false },
  ],
  retirement: [
    { type: 'tsc_slip',                        label: 'TSC Slip',                        required: true },
    { type: 'letter_of_compulsory_retirement', label: 'Letter of Compulsory Retirement', required: true },
  ],
};
// Free-form extras sit outside the slots: several may coexist, so they are
// appended rather than replaced.
const EXTRA_DOC_TYPE = 'other';

const slotsFor = (claimType) => BBF_DOC_SLOTS[claimType] || BBF_DOC_SLOTS.death;

// A death claim records a real past event; a date in the future is a typo or a
// bad client. Returns an error message, or null when the fields are acceptable.
function deathFieldError(claim_type, deceased_name, relationship, date_of_death) {
  if (claim_type !== 'death') return null;
  if (!deceased_name || !relationship || !date_of_death) {
    return 'Deceased name, relationship and date of death are required for a death claim';
  }
  const dod = new Date(date_of_death);
  if (Number.isNaN(dod.getTime())) return 'Date of death is not a valid date';
  // Compare against end-of-today so "today" is accepted in any timezone.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (dod > endOfToday) return 'Date of death cannot be in the future';
  return null;
}

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
    const deathErr = deathFieldError(claim_type, deceased_name, relationship, date_of_death);
    if (deathErr) return res.status(400).json({ success: false, message: deathErr });

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

// Edit a draft claim's particulars (type + death-specific fields). Only allowed
// while the claim is still a draft — once submitted it is locked.
async function update(req, res) {
  try {
    const { claim_type, deceased_name, relationship, date_of_death } = req.body;

    if (!claim_type || !['death', 'retirement'].includes(claim_type)) {
      return res.status(400).json({ success: false, message: 'Claim type must be death or retirement' });
    }
    const deathErr = deathFieldError(claim_type, deceased_name, relationship, date_of_death);
    if (deathErr) return res.status(400).json({ success: false, message: deathErr });

    const [[claim]] = await db.query(
      'SELECT status FROM bbf_claims WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (claim.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft claims can be edited' });

    // For a death claim the "name" is the deceased relative; for retirement it is the member (the retiree).
    const [[m]] = await db.query('SELECT full_name FROM members WHERE id = ?', [req.member.id]);
    if (!m) return res.status(404).json({ success: false, message: 'Member profile not found' });
    const claimName = claim_type === 'death' ? deceased_name : m.full_name;

    await db.query(
      'UPDATE bbf_claims SET claim_type = ?, deceased_name = ?, relationship = ?, date_of_death = ? WHERE id = ?',
      [
        claim_type, claimName,
        claim_type === 'death' ? relationship : null,
        claim_type === 'death' ? date_of_death : null,
        req.params.id,
      ]
    );
    const [[updated]] = await db.query('SELECT * FROM bbf_claims WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated, message: 'Claim updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update claim' });
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
    // Required documents differ by claim type — see BBF_DOC_SLOTS.
    const missing = slotsFor(claim.claim_type).filter(s => s.required && !uploaded.has(s.type));
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required documents: ${missing.map(s => s.label).join(', ')}` });
    }

    // Conditional on the status we just read: two overlapping submits (a
    // double-tap on a slow connection) would otherwise both pass the check
    // above and each write a timeline row and fire a notification — meaning two
    // SMS messages and two emails for one claim. Only the first update matches.
    const [result] = await db.query(
      'UPDATE bbf_claims SET status = "submitted", submitted_at = NOW() WHERE id = ? AND status = "draft"',
      [claim.id]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ success: false, message: 'This claim has already been submitted' });
    }
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
  // Any path that rejects the request must discard the files multer already
  // wrote, or they sit on the upload dir forever with nothing referencing them.
  const reject = async (status, message) => {
    await removeUploadedFiles(req);
    return res.status(status).json({ success: false, message });
  };
  try {
    const [[claim]] = await db.query(
      'SELECT id, status, claim_type FROM bbf_claims WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    if (!claim) return reject(404, 'Claim not found');
    // Documents are the basis the claim is decided on, so they are locked once
    // it leaves draft — otherwise the evidence could change after review, with
    // nothing in the timeline recording it. The member UI hides the upload
    // controls for a non-draft claim; this is the guard behind that.
    if (claim.status !== 'draft') {
      return reject(400, 'This claim has already been submitted, so its documents can no longer be changed. Contact the branch office if a document needs correcting.');
    }
    if (!req.files || !req.files.length) return reject(400, 'No files uploaded');

    // doc_type lands in an ENUM column. Unvalidated, an unrecognised value either
    // errors (surfacing as a bare 500) or — on a non-strict server — is coerced to
    // '', leaving a document that looks uploaded but can never satisfy the
    // required-document check, so the member is stuck with nothing explaining why.
    const docType = req.body.doc_type || EXTRA_DOC_TYPE;
    const slot = slotsFor(claim.claim_type).find(s => s.type === docType);
    if (!slot && docType !== EXTRA_DOC_TYPE) {
      return reject(400, 'That document type does not apply to this claim');
    }
    // A slot holds exactly one document; "other" is a free-form bucket.
    if (slot && req.files.length > 1) {
      return reject(400, `Please upload a single file for ${slot.label}`);
    }

    // Re-uploading a slot replaces what was there — it used to append, leaving
    // the member's page showing the first upload while an admin saw both with no
    // way to tell which was current.
    let superseded = [];
    if (slot) {
      const [existing] = await db.query(
        'SELECT file_url FROM bbf_claim_documents WHERE claim_id = ? AND doc_type = ?',
        [claim.id, docType]
      );
      superseded = existing.map(d => d.file_url);
    }

    // All-or-nothing: if one statement fails the rest roll back, so the catch can
    // safely delete every uploaded file knowing no row references it.
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (slot) {
        await conn.query('DELETE FROM bbf_claim_documents WHERE claim_id = ? AND doc_type = ?', [claim.id, docType]);
      }
      for (const file of req.files) {
        await conn.query(
          'INSERT INTO bbf_claim_documents (claim_id, doc_type, file_url, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [claim.id, docType, `/uploads/bbf/${file.filename}`, file.originalname, file.size, req.member.id]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Committed — the replaced rows are gone, so their files can go too.
    for (const url of superseded) await removeStoredFile(url);

    res.json({ success: true, message: `${req.files.length} document(s) uploaded` });
  } catch (err) {
    return reject(500, 'Upload failed');
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

module.exports = { getAll, create, update, getOne, submitClaim, uploadDocuments, getTimeline };
