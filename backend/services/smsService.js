const db = require('../config/database');

const BASE_URL   = (process.env.TALKSASA_BASE_URL || 'https://bulksms.talksasa.com/api/v3').replace(/\/+$/, '');
const API_KEY    = process.env.TALKSASA_API_KEY  || '';
const SENDER_ID  = process.env.TALKSASA_SENDER_ID || 'KUPPET';

// Replace {{key}} placeholders in a template body
function resolveTemplate(body, vars = {}) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// Send a single SMS. Never throws — all errors are logged to sms_logs.
async function sendSms({ phone, message, memberId = null, sentBy, templateId = null }) {
  let talksasaRef = null;
  let status = 'failed';
  let errorMessage = null;

  if (API_KEY) {
    try {
      const response = await fetch(`${BASE_URL}/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          recipient: normalizePhone(phone),
          sender_id: SENDER_ID,
          type: 'plain',
          message,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status !== 'error') {
        status = 'sent';
        talksasaRef = data.data?.uid || data.data?.message_id || data.message_id || data.reference || null;
      } else {
        errorMessage = data.message || data.error || `HTTP ${response.status}`;
      }
    } catch (err) {
      errorMessage = err.message;
    }
  } else {
    // No API key configured — log as queued for later processing
    status = 'queued';
    errorMessage = 'No TALKSASA_API_KEY configured';
  }

  try {
    await db.query(
      `INSERT INTO sms_logs
         (recipient_phone, member_id, message, message_type, template_id, status,
          talksasa_ref, error_message, sent_by, sent_at)
       VALUES (?, ?, ?, 'individual', ?, ?, ?, ?, ?, ?)`,
      [phone, memberId, message, templateId, status, talksasaRef, errorMessage, sentBy,
       status === 'sent' ? new Date() : null]
    );
  } catch (_) { /* log failure must not propagate */ }

  return { success: status === 'sent', status, talksasaRef, error: errorMessage };
}

// Send bulk SMS to an array of recipients. Returns array of results.
async function sendBulk({ recipients, message, sentBy, templateId = null }) {
  const results = await Promise.allSettled(
    recipients.map(r => sendSms({
      phone: r.phone,
      message: resolveTemplate(message, r.vars || {}),
      memberId: r.memberId || null,
      sentBy,
      templateId,
    }))
  );
  return results.map((r, i) => ({
    phone: recipients[i].phone,
    ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
  }));
}

// Update delivery status from TalkSasa webhook
async function updateDeliveryStatus(talksasaRef, delivered) {
  await db.query(
    `UPDATE sms_logs SET status = ? WHERE talksasa_ref = ?`,
    [delivered ? 'delivered' : 'failed', talksasaRef]
  );
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return digits;
}

module.exports = { sendSms, sendBulk, resolveTemplate, updateDeliveryStatus };
