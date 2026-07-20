const db = require('../config/database');
const { clampLimit, clampOffset } = require('../utils/pagination');
const smsService = require('../services/smsService');

// Above this many recipients, a bulk/group send is processed in the background
// (respond immediately, drain in batches) instead of making the admin wait for
// every message. Small sends stay inline so the response still carries a
// sent/total count. Configurable via SMS_BACKGROUND_THRESHOLD.
const BG_THRESHOLD = (() => { const n = parseInt(process.env.SMS_BACKGROUND_THRESHOLD, 10); return Number.isFinite(n) ? n : 25; })();

async function send(req, res) {
  try {
    const { phone, message, member_id, template_id } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, message: 'Phone and message required' });
    const result = await smsService.sendSms({ phone, message, memberId: member_id || null, sentBy: req.user.id, templateId: template_id || null });
    const message_out = result.status === 'sent'
      ? 'SMS sent'
      : result.status === 'queued'
        ? 'SMS queued — no API key configured'
        : `SMS failed: ${result.error || 'check TalkSasa configuration'}`;
    res.json({ success: result.success, data: result, message: message_out });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send SMS' });
  }
}

async function bulk(req, res) {
  try {
    const { recipients, message } = req.body;
    if (!recipients?.length || !message) return res.status(400).json({ success: false, message: 'Recipients and message required' });
    if (recipients.length > BG_THRESHOLD) {
      const { queued } = smsService.queueBulk({ recipients, message, sentBy: req.user.id });
      return res.json({ success: true, background: true, queued, message: `Queued ${queued} messages — sending in the background. Watch SMS Logs for delivery status.` });
    }
    const results = await smsService.sendBulk({ recipients, message, sentBy: req.user.id });
    const sent = results.filter(r => r.success).length;
    res.json({ success: true, data: results, message: `${sent}/${results.length} messages sent` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bulk send failed' });
  }
}

async function sendToGroup(req, res) {
  try {
    const { group, message, template_id } = req.body;
    if (!group || !message) return res.status(400).json({ success: false, message: 'Group and message required' });

    let query = 'SELECT id, full_name, phone FROM members WHERE status = "approved"';
    if (group === 'all_approved') { /* no filter */ }
    else if (group === 'sub_county') { query += ' AND sub_county = ?'; }

    const [members] = await db.query(query, group === 'sub_county' ? [req.body.sub_county] : []);
    const recipients = members.map(m => ({ phone: m.phone, memberId: m.id, vars: { member_name: m.full_name } }));
    if (!recipients.length) return res.json({ success: true, message: 'No approved members in that group' });
    if (recipients.length > BG_THRESHOLD) {
      const { queued } = smsService.queueBulk({ recipients, message, sentBy: req.user.id, templateId: template_id });
      return res.json({ success: true, background: true, queued, message: `Queued ${queued} messages to the ${group} group — sending in the background. Watch SMS Logs for delivery status.` });
    }
    const results = await smsService.sendBulk({ recipients, message, sentBy: req.user.id, templateId: template_id });
    const sent = results.filter(r => r.success).length;
    res.json({ success: true, message: `${sent}/${results.length} messages sent to ${group} group` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Group send failed' });
  }
}

async function getLogs(req, res) {
  try {
    const { status, limit = 30, offset = 0 } = req.query;
    let query = 'SELECT * FROM sms_logs WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(clampLimit(limit, 30), clampOffset(offset));
    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM sms_logs' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
}

// Actively re-check a message's delivery status against TalkSasa's queue
// endpoint (for messages that never received a webhook DLR). Updates the row.
async function checkStatus(req, res) {
  try {
    const [[log]] = await db.query('SELECT id, talksasa_ref, status FROM sms_logs WHERE id = ?', [req.params.id]);
    if (!log) return res.status(404).json({ success: false, message: 'Log entry not found' });
    if (!log.talksasa_ref) {
      return res.json({ success: false, message: 'No TalkSasa reference stored — this message predates delivery tracking and cannot be checked' });
    }
    const result = await smsService.checkDelivery(log.talksasa_ref);
    if (result.error) return res.json({ success: false, message: `Status check failed: ${result.error}` });
    const newStatus = result.mapped || log.status;
    const message = result.mapped
      ? `Delivery status: ${result.mapped}`
      : `TalkSasa reports "${result.rawStatus || 'pending/unknown'}" — not yet a final delivery state`;
    res.json({ success: true, data: { status: newStatus, raw: result.rawStatus || null }, message });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check status' });
  }
}

async function getTemplates(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM sms_templates WHERE is_active = 1 ORDER BY category, name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
}

async function createTemplate(req, res) {
  try {
    const { name, body, category } = req.body;
    if (!name || !body) return res.status(400).json({ success: false, message: 'Name and body required' });
    const [result] = await db.query(
      'INSERT INTO sms_templates (name, body, category, created_by) VALUES (?, ?, ?, ?)',
      [name, body, category || 'general', req.user.id]
    );
    const [[row]] = await db.query('SELECT * FROM sms_templates WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
}

async function updateTemplate(req, res) {
  try {
    const { name, body, category, is_active } = req.body;
    const fields = [], params = [];
    if (name !== undefined)      { fields.push('name = ?'); params.push(name); }
    if (body !== undefined)      { fields.push('body = ?'); params.push(body); }
    if (category !== undefined)  { fields.push('category = ?'); params.push(category); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE sms_templates SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Template updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
}

// TalkSasa delivery receipt (DLR) webhook.
// TalkSasa field names vary, so accept the common ones; we match on the same
// reference we stored as talksasa_ref when the message was accepted.
async function webhook(req, res) {
  try {
    const b = req.body || {};
    const d = b.data || {};
    const reference = b.reference || b.queue_uid || b.uid || b.message_id || b.messageId || b.id ||
                      d.queue_uid || d.uid || d.message_id || null;
    const status = b.status || b.dlr_status || b.delivery_status || b.message_status ||
                   d.status || d.dlr_status || null;
    console.log('[sms webhook]', JSON.stringify(b));
    if (reference) await smsService.updateDeliveryStatus(reference, status);
    res.json({ success: true });
  } catch (_) {
    res.json({ success: true }); // always 200 so TalkSasa doesn't retry-storm
  }
}

module.exports = { send, bulk, sendToGroup, getLogs, checkStatus, getTemplates, createTemplate, updateTemplate, webhook };
