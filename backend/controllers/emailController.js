const db = require('../config/database');
const mailerService = require('../services/mailerService');

// Compose a branded admin email from a subject + plain-text body.
function build(name, subject, message) {
  return mailerService.templates.adminEmail(name, subject, message);
}

// Send a batch sequentially; returns the count that succeeded. mailerService
// never throws and returns { skipped } when SMTP is unconfigured.
async function sendBatch(recipients, subject, message) {
  let sent = 0, skipped = false;
  for (const r of recipients) {
    if (!r.email) continue;
    const result = await mailerService.sendMail({ to: r.email, ...build(r.name, subject, message) });
    if (result.success) sent++;
    if (result.skipped) skipped = true;
  }
  return { sent, skipped };
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
