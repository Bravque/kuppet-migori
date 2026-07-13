const db = require('../config/database');
const smsService = require('./smsService');
const mailerService = require('./mailerService');

// SMS is sent for BBF and scholarship status changes; general/system notifs are in-app only.
const SMS_TYPES = new Set(['bbf_claim', 'scholarship']);

async function createNotification({ memberId, type, title, body, referenceId = null, smsMessage = null, email = false, adminId = 1 }) {
  await db.query(
    `INSERT INTO notifications (member_id, type, title, body, reference_id)
     VALUES (?, ?, ?, ?, ?)`,
    [memberId, type, title, body || null, referenceId]
  );

  const wantsSms = SMS_TYPES.has(type) && smsMessage;
  if (!wantsSms && !email) return;

  // Fetch member contact details once for whichever channels are requested.
  const [[member]] = await db.query('SELECT full_name, phone, email FROM members WHERE id = ?', [memberId]);
  if (!member) return;

  if (wantsSms) {
    await smsService.sendSms({
      phone: member.phone,
      message: smsMessage,
      memberId,
      sentBy: adminId,
    });
  }

  // Email uses the notification title/body; mailerService fails gracefully if SMTP is unset.
  if (email && member.email) {
    const tpl = mailerService.templates.memberNotice(member.full_name, title, body);
    await mailerService.sendMail({ to: member.email, ...tpl });
  }
}

module.exports = { createNotification };
