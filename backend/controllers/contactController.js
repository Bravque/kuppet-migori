const db = require('../config/database');
const { validationResult } = require('express-validator');
const { sendMail, templates } = require('../services/mailerService');

const submit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, subject, message, category } = req.body;
    const cat = category || 'general';
    const ip = req.ip || req.connection.remoteAddress;

    await db.query(
      'INSERT INTO contacts (name, email, phone, subject, message, category, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, subject || null, message, cat, ip]
    );

    // Fire-and-forget notifications (mailer never throws — fails gracefully if SMTP is off):
    //  1. alert the branch inbox (reply-to the enquirer so staff can answer directly)
    //  2. auto-acknowledge the enquirer
    const inbox = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
    if (inbox) {
      const alert = templates.contactStaffAlert({ name, email, phone, subject, message, category: cat });
      sendMail({ to: inbox, subject: alert.subject, html: alert.html, replyTo: email });
    }
    const ack = templates.contactAutoReply(name, cat);
    sendMail({ to: email, subject: ack.subject, html: ack.html });

    res.json({ success: true, message: 'Your message has been received. We will respond within 2 business days.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit message. Please try again or call our office directly.' });
  }
};

// Admin: email a reply to the enquirer, record it, and mark the thread replied.
const reply = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const { message } = req.body;
    const [[contact]] = await db.query('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    if (!contact) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    const tpl = templates.contactReply(contact.name, contact.subject, contact.message, message);
    const result = await sendMail({ to: contact.email, subject: tpl.subject, html: tpl.html });
    if (result.skipped) {
      return res.status(503).json({ success: false, message: 'Email is not configured on the server, so the reply could not be sent.' });
    }
    if (!result.success) {
      return res.status(502).json({ success: false, message: 'The reply email failed to send. Please try again.' });
    }

    await db.query(
      'UPDATE contacts SET admin_reply = ?, replied_at = NOW(), status = ? WHERE id = ?',
      [message, 'replied', req.params.id]
    );
    res.json({ success: true, message: `Reply sent to ${contact.email}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send reply' });
  }
};

const adminGetAll = async (req, res) => {
  try {
    const { status, category, limit = 20, offset = 0 } = req.query;
    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM contacts WHERE 1=1' +
      (status ? ' AND status = ?' : '') + (category ? ' AND category = ?' : ''),
      [...(status ? [status] : []), ...(category ? [category] : [])]
    );
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
  }
};

const adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['new', 'read', 'replied', 'closed'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const [[existing]] = await db.query('SELECT id FROM contacts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Contact not found' });
    await db.query('UPDATE contacts SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

module.exports = { submit, reply, adminGetAll, adminUpdateStatus };
