const db = require('../config/database');
const smsService = require('./smsService');

// SMS is sent for BBF and scholarship status changes; general/system notifs are in-app only.
const SMS_TYPES = new Set(['bbf_claim', 'scholarship']);

async function createNotification({ memberId, type, title, body, referenceId = null, smsMessage = null, adminId = 1 }) {
  await db.query(
    `INSERT INTO notifications (member_id, type, title, body, reference_id)
     VALUES (?, ?, ?, ?, ?)`,
    [memberId, type, title, body || null, referenceId]
  );

  if (SMS_TYPES.has(type) && smsMessage) {
    const [[member]] = await db.query('SELECT phone FROM members WHERE id = ?', [memberId]);
    if (member) {
      await smsService.sendSms({
        phone: member.phone,
        message: smsMessage,
        memberId,
        sentBy: adminId,
      });
    }
  }
}

module.exports = { createNotification };
