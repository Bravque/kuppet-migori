const db = require('../config/database');
const notificationService = require('../services/notificationService');

// List all application-notification templates (BBF + scholarship status),
// merging each default with any admin override.
async function list(req, res) {
  try {
    const defs = notificationService.NOTIFICATION_TEMPLATES;
    const [rows] = await db.query('SELECT template_key, title, body, sms, updated_at FROM notification_templates');
    const overrides = Object.fromEntries(rows.map(r => [r.template_key, r]));
    const data = Object.entries(defs).map(([key, d]) => {
      const ov = overrides[key];
      return {
        key,
        label: d.label,
        group: d.group,
        description: d.description,
        variables: d.variables,
        default_title: d.title,
        default_body: d.body,
        default_sms: d.sms,
        title: ov ? ov.title : d.title,
        body: ov ? ov.body : d.body,
        sms: ov ? ov.sms : d.sms,
        is_customized: !!ov,
        updated_at: ov ? ov.updated_at : null,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
}

async function update(req, res) {
  try {
    const { key } = req.params;
    const def = notificationService.NOTIFICATION_TEMPLATES[key];
    if (!def) return res.status(404).json({ success: false, message: 'Unknown template' });
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and message are required' });
    // SMS is not editable here (email-only page); store the code default so the
    // NOT NULL column stays populated. renderNotification always uses the default.
    await db.query(
      `INSERT INTO notification_templates (template_key, title, body, sms, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), sms = VALUES(sms), updated_by = VALUES(updated_by)`,
      [key, title, body, def.sms, req.user.id]
    );
    await notificationService.loadNotificationCache();
    res.json({ success: true, message: 'Template saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save template' });
  }
}

async function reset(req, res) {
  try {
    const { key } = req.params;
    if (!notificationService.NOTIFICATION_TEMPLATES[key]) return res.status(404).json({ success: false, message: 'Unknown template' });
    await db.query('DELETE FROM notification_templates WHERE template_key = ?', [key]);
    await notificationService.loadNotificationCache();
    res.json({ success: true, message: 'Reverted to default' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset template' });
  }
}

module.exports = { list, update, reset };
