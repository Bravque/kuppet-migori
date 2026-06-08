const db = require('../config/database');
const smsService = require('../services/smsService');

async function send(req, res) {
  try {
    const { phone, message, member_id, template_id } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, message: 'Phone and message required' });
    const result = await smsService.sendSms({ phone, message, memberId: member_id || null, sentBy: req.user.id, templateId: template_id || null });
    res.json({ success: true, data: result, message: result.success ? 'SMS sent' : 'SMS queued (check API key config)' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send SMS', error: err.message });
  }
}

async function bulk(req, res) {
  try {
    const { recipients, message } = req.body;
    if (!recipients?.length || !message) return res.status(400).json({ success: false, message: 'Recipients and message required' });
    const results = await smsService.sendBulk({ recipients, message, sentBy: req.user.id });
    const sent = results.filter(r => r.success).length;
    res.json({ success: true, data: results, message: `${sent}/${results.length} messages sent` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bulk send failed', error: err.message });
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
    const results = await smsService.sendBulk({ recipients, message, sentBy: req.user.id, templateId: template_id });
    const sent = results.filter(r => r.success).length;
    res.json({ success: true, message: `${sent}/${results.length} messages sent to ${group} group` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Group send failed', error: err.message });
  }
}

async function getLogs(req, res) {
  try {
    const { status, limit = 30, offset = 0 } = req.query;
    let query = 'SELECT * FROM sms_logs WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM sms_logs' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs', error: err.message });
  }
}

async function getTemplates(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM sms_templates WHERE is_active = 1 ORDER BY category, name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates', error: err.message });
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
    res.status(500).json({ success: false, message: 'Failed to create template', error: err.message });
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
    res.status(500).json({ success: false, message: 'Failed to update template', error: err.message });
  }
}

// TalkSasa delivery receipt webhook
async function webhook(req, res) {
  try {
    const { reference, status } = req.body;
    if (reference) {
      await smsService.updateDeliveryStatus(reference, status === 'delivered');
    }
    res.json({ success: true });
  } catch (_) {
    res.json({ success: true }); // always 200 to webhook
  }
}

module.exports = { send, bulk, sendToGroup, getLogs, getTemplates, createTemplate, updateTemplate, webhook };
