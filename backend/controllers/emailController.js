const db = require('../config/database');
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

// Send a batch **sequentially with a pause between messages** so we don't burst
// past the SMTP provider's rate limit (Hostinger throttles/caps per hour).
// Pace via EMAIL_SEND_DELAY_MS (default 200ms). mailerService never throws and
// returns { skipped } when SMTP is unconfigured — in that case stop early, since
// no further send can succeed. Returns counts.
async function sendBatch(recipients, subject, message) {
  const delay = Math.max(0, intEnv(process.env.EMAIL_SEND_DELAY_MS, 200));
  let sent = 0, failed = 0, skipped = false;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (!r.email) continue;
    const result = await mailerService.sendMail({ to: r.email, ...build(r.name, subject, message) });
    if (result.skipped) { skipped = true; break; }   // SMTP unconfigured — no point continuing
    if (result.success) sent++; else failed++;
    if (delay && i + 1 < recipients.length) await sleep(delay);
  }
  return { sent, failed, skipped };
}

// Fire-and-forget paced batch. Returns the queued count immediately so the
// admin's request doesn't hang; the sends then drain in the background. Never
// throws — the background promise is .catch-guarded. Caveat: no per-email log
// table exists, so progress isn't visible in the UI, and a process restart
// mid-run stops the remainder (already-sent emails are unaffected).
function queueBatch(recipients, subject, message) {
  const queued = recipients.length;
  Promise.resolve()
    .then(() => sendBatch(recipients, subject, message))
    .then(({ sent, skipped }) => console.log(`[bulk-email] background send complete: ${sent}/${queued}${skipped ? ' (SMTP unconfigured)' : ''}`))
    .catch((err) => console.error('[bulk-email] background send failed:', err));
  return { queued };
}

async function send(req, res) {
  try {
    const { email, subject, message, name } = req.body;
    if (!email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Email, subject and message are required' });
    }
    const result = await mailerService.sendMail({ to: email, ...build(name, subject, message) });
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
    if (recipients.length > BG_THRESHOLD) {
      const { queued } = queueBatch(recipients, subject, message);
      return res.json({ success: true, background: true, queued, message: `Queued ${queued} emails — sending in the background. Large sends can take a while and are subject to the mail provider's hourly limit.` });
    }
    const { sent, skipped } = await sendBatch(recipients, subject, message);
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
    let query = 'SELECT full_name AS name, email FROM members WHERE status = "approved" AND email IS NOT NULL AND email <> ""';
    if (group === 'sub_county') query += ' AND sub_county = ?';
    const [members] = await db.query(query, group === 'sub_county' ? [sub_county] : []);
    if (!members.length) {
      return res.json({ success: true, message: 'No approved members with an email address in that group' });
    }
    if (members.length > BG_THRESHOLD) {
      const { queued } = queueBatch(members, subject, message);
      return res.json({ success: true, background: true, queued, message: `Queued ${queued} emails to the ${group} group — sending in the background. Large sends can take a while and are subject to the mail provider's hourly limit.` });
    }
    const { sent, skipped } = await sendBatch(members, subject, message);
    if (skipped && sent === 0) {
      return res.json({ success: false, message: 'Emails not sent — SMTP is not configured on the server' });
    }
    res.json({ success: true, message: `${sent}/${members.length} emails sent to ${group} group` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Group send failed' });
  }
}

module.exports = { send, bulk, sendToGroup };
