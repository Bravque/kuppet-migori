const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');
const mailerService = require('../services/mailerService');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const intEnv = (v, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : dflt; };

// Above this many recipients, a bulk/group send is processed in the background
// (respond immediately, drain over time) instead of holding the request open —
// which would time out at the gateway for thousands of emails. Configurable.
const BG_THRESHOLD = intEnv(process.env.EMAIL_BACKGROUND_THRESHOLD, 25);

// Compose a branded admin email from a subject + plain-text body.
function build(name, subject, message) {
  return mailerService.templates.adminEmail(name, subject, message);
}

// Record one email attempt to email_logs. Never throws — logging must never
// break a send. Called once per recipient so the Email Logs page can show
// progress/status of backgrounded blasts.
async function logEmail({ recipientEmail, recipientName = null, memberId = null, subject, message, type, status, error = null, sentBy }) {
  try {
    await db.query(
      `INSERT INTO email_logs
         (recipient_email, recipient_name, member_id, subject, message, message_type, status, error_message, sent_by, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recipientEmail, recipientName, memberId, subject, message, type, status, error, sentBy, status === 'sent' ? new Date() : null]
    );
  } catch (_) { /* swallow — a logging failure must not abort the send loop */ }
}

// Map a mailerService result to an email_logs status + error string.
function classify(result) {
  if (result.skipped) return { status: 'skipped', error: 'SMTP not configured' };
  if (result.success) return { status: 'sent', error: null };
  return { status: 'failed', error: 'Send failed' };
}

// Send a batch **sequentially with a pause between messages** so we don't burst
// past the SMTP provider's rate limit (Hostinger throttles/caps per hour).
// Pace via EMAIL_SEND_DELAY_MS (default 200ms). mailerService never throws and
// returns { skipped } when SMTP is unconfigured — in that case stop early, since
// no further send can succeed. Every attempt is written to email_logs. Returns counts.
async function sendBatch(recipients, subject, message, { sentBy, type }) {
  const delay = Math.max(0, intEnv(process.env.EMAIL_SEND_DELAY_MS, 200));
  let sent = 0, failed = 0, skipped = false;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (!r.email) continue;
    const result = await mailerService.sendMail({ to: r.email, ...build(r.name, subject, message) });
    const { status, error } = classify(result);
    await logEmail({ recipientEmail: r.email, recipientName: r.name || null, memberId: r.member_id || null, subject, message, type, status, error, sentBy });
    if (result.skipped) { skipped = true; break; }   // SMTP unconfigured — no point continuing
    if (result.success) sent++; else failed++;
    if (delay && i + 1 < recipients.length) await sleep(delay);
  }
  return { sent, failed, skipped };
}

// Fire-and-forget paced batch. Returns the queued count immediately so the
// admin's request doesn't hang; the sends then drain in the background, each
// landing in email_logs as it completes (watch the Email Logs page for
// progress). Never throws — the background promise is .catch-guarded. Caveat: a
// process restart mid-run stops the remainder (already-sent rows are unaffected).
function queueBatch(recipients, subject, message, meta) {
  const queued = recipients.length;
  Promise.resolve()
    .then(() => sendBatch(recipients, subject, message, meta))
    .then(({ sent, skipped }) => console.log(`[bulk-email] background send complete: ${sent}/${queued}${skipped ? ' (SMTP unconfigured)' : ''}`))
    .catch((err) => console.error('[bulk-email] background send failed:', err));
  return { queued };
}

async function send(req, res) {
  try {
    const { email, subject, message, name, member_id } = req.body;
    if (!email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Email, subject and message are required' });
    }
    const result = await mailerService.sendMail({ to: email, ...build(name, subject, message) });
    const { status, error } = classify(result);
    await logEmail({ recipientEmail: email, recipientName: name || null, memberId: member_id || null, subject, message, type: 'individual', status, error, sentBy: req.user.id });
    if (result.skipped) {
      return res.json({ success: false, message: 'Email not sent — SMTP is not configured on the server' });
    }
    res.json({ success: !!result.success, message: result.success ? 'Email sent' : 'Email failed to send' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
}

async function bulk(req, res) {
  try {
    const { recipients, subject, message } = req.body;
    if (!recipients?.length || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Recipients, subject and message are required' });
    }
    const meta = { sentBy: req.user.id, type: 'bulk' };
    if (recipients.length > BG_THRESHOLD) {
      const { queued } = queueBatch(recipients, subject, message, meta);
      return res.json({ success: true, background: true, queued, message: `Queued ${queued} emails — sending in the background. Large sends can take a while and are subject to the mail provider's hourly limit. Watch Email Logs for progress.` });
    }
    const { sent, skipped } = await sendBatch(recipients, subject, message, meta);
    if (skipped && sent === 0) {
      return res.json({ success: false, message: 'Emails not sent — SMTP is not configured on the server' });
    }
    res.json({ success: true, message: `${sent}/${recipients.length} emails sent` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bulk send failed' });
  }
}

async function sendToGroup(req, res) {
  try {
    const { group, subject, message, sub_county } = req.body;
    if (!group || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Group, subject and message are required' });
    }
    let query = 'SELECT id, full_name AS name, email FROM members WHERE status = "approved" AND email IS NOT NULL AND email <> ""';
    if (group === 'sub_county') query += ' AND sub_county = ?';
    const [rows] = await db.query(query, group === 'sub_county' ? [sub_county] : []);
    if (!rows.length) {
      return res.json({ success: true, message: 'No approved members with an email address in that group' });
    }
    const members = rows.map((m) => ({ email: m.email, name: m.name, member_id: m.id }));
    const meta = { sentBy: req.user.id, type: 'group' };
    if (members.length > BG_THRESHOLD) {
      const { queued } = queueBatch(members, subject, message, meta);
      return res.json({ success: true, background: true, queued, message: `Queued ${queued} emails to the ${group} group — sending in the background. Large sends can take a while and are subject to the mail provider's hourly limit. Watch Email Logs for progress.` });
    }
    const { sent, skipped } = await sendBatch(members, subject, message, meta);
    if (skipped && sent === 0) {
      return res.json({ success: false, message: 'Emails not sent — SMTP is not configured on the server' });
    }
    res.json({ success: true, message: `${sent}/${members.length} emails sent to ${group} group` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Group send failed' });
  }
}

async function getLogs(req, res) {
  try {
    const { status, limit = 30, offset = 0 } = req.query;
    let query = 'SELECT * FROM email_logs WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(clampLimit(limit, 30), clampOffset(offset));
    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM email_logs' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
}

// ── Email templates (reusable subject + body) ────────────────────────────────
async function getTemplates(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM email_templates WHERE is_active = 1 ORDER BY category, name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
}

async function createTemplate(req, res) {
  try {
    const { name, subject, body, category } = req.body;
    if (!name || !subject || !body) return res.status(400).json({ success: false, message: 'Name, subject and body required' });
    const [result] = await db.query(
      'INSERT INTO email_templates (name, subject, body, category, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, subject, body, category || 'general', req.user.id]
    );
    const [[row]] = await db.query('SELECT * FROM email_templates WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
}

async function updateTemplate(req, res) {
  try {
    const { name, subject, body, category, is_active } = req.body;
    const fields = [], params = [];
    if (name !== undefined)      { fields.push('name = ?'); params.push(name); }
    if (subject !== undefined)   { fields.push('subject = ?'); params.push(subject); }
    if (body !== undefined)      { fields.push('body = ?'); params.push(body); }
    if (category !== undefined)  { fields.push('category = ?'); params.push(category); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE email_templates SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Template updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
}

// ── Transactional (automated) email templates ────────────────────────────────
// Editable subject + body for the fixed set of system emails defined in
// mailerService.TRANSACTIONAL_TEMPLATES. Overrides stored per key; absence =
// default. Returns each template merged with any override + its default.
async function getTransactionalTemplates(req, res) {
  try {
    const defs = mailerService.TRANSACTIONAL_TEMPLATES;
    const [rows] = await db.query('SELECT template_key, subject, body, updated_at FROM transactional_templates');
    const overrides = Object.fromEntries(rows.map(r => [r.template_key, r]));
    // Only expose editable templates (e.g. password_reset is locked).
    const data = Object.entries(defs).filter(([, d]) => d.editable !== false).map(([key, d]) => {
      const ov = overrides[key];
      return {
        key,
        label: d.label,
        description: d.description,
        variables: d.variables,
        default_subject: d.subject,
        default_body: d.body,
        subject: ov ? ov.subject : d.subject,
        body: ov ? ov.body : d.body,
        is_customized: !!ov,
        updated_at: ov ? ov.updated_at : null,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
}

async function updateTransactionalTemplate(req, res) {
  try {
    const { key } = req.params;
    const def = mailerService.TRANSACTIONAL_TEMPLATES[key];
    if (!def) return res.status(404).json({ success: false, message: 'Unknown template' });
    if (def.editable === false) return res.status(403).json({ success: false, message: 'This template is not editable' });
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ success: false, message: 'Subject and body required' });
    await db.query(
      `INSERT INTO transactional_templates (template_key, subject, body, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE subject = VALUES(subject), body = VALUES(body), updated_by = VALUES(updated_by)`,
      [key, subject, body, req.user.id]
    );
    await mailerService.loadTransactionalCache();
    res.json({ success: true, message: 'Template saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save template' });
  }
}

async function resetTransactionalTemplate(req, res) {
  try {
    const { key } = req.params;
    const def = mailerService.TRANSACTIONAL_TEMPLATES[key];
    if (!def) return res.status(404).json({ success: false, message: 'Unknown template' });
    if (def.editable === false) return res.status(403).json({ success: false, message: 'This template is not editable' });
    await db.query('DELETE FROM transactional_templates WHERE template_key = ?', [key]);
    await mailerService.loadTransactionalCache();
    res.json({ success: true, message: 'Reverted to default' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset template' });
  }
}

module.exports = {
  send, bulk, sendToGroup, getLogs,
  getTemplates, createTemplate, updateTemplate,
  getTransactionalTemplates, updateTransactionalTemplate, resetTransactionalTemplate,
};
