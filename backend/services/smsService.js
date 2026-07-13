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
        // TalkSasa v3 returns the id as data.data.queue_uid on a successful send
        // (HTTP 202 "accepted"); older/other shapes use uid/message_id. Capture
        // whichever is present — the DLR webhook matches sms_logs on this ref.
        talksasaRef = data.data?.queue_uid || data.data?.uid || data.data?.message_id || data.message_id || data.reference || null;
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

// Map a raw TalkSasa delivery-report status word to our sms_logs enum.
// Returns null for unknown/intermediate values so we don't overwrite wrongly.
function mapDlrStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (/deliver/.test(s)) return 'delivered';                              // Delivered, DELIVRD
  if (/fail|reject|undeliver|expir|dnd|block|invalid/.test(s)) return 'failed';
  if (/sent|submit|accept|queue|pending/.test(s)) return 'sent';
  return null;
}

// Update delivery status from a TalkSasa webhook (DLR). Returns the mapped
// status, or null if nothing was updated.
async function updateDeliveryStatus(talksasaRef, rawStatus) {
  const mapped = mapDlrStatus(rawStatus);
  if (!talksasaRef || !mapped) return null;
  await db.query('UPDATE sms_logs SET status = ? WHERE talksasa_ref = ?', [mapped, talksasaRef]);
  return mapped;
}

// Pull a delivery-status word out of a TalkSasa queue-status payload. The inner
// `data` object carries the delivery state (the outer `status` is just the API
// call result); a per-recipient array may also be present.
function extractQueueStatus(body) {
  const d = body?.data || {};
  if (Array.isArray(d.recipients) && d.recipients.length) {
    const r = d.recipients[0];
    return r.status || r.delivery_status || r.dlr_status || null;
  }
  return d.delivery_status || d.dlr_status || d.status || null;
}

// Actively poll TalkSasa for the delivery status of a queued message (the
// GET /sms/queue/{uid} endpoint whose URL TalkSasa returns as check_status_url).
// Updates sms_logs to the mapped status when a terminal/known state is returned.
// Never throws — returns { rawStatus, mapped, raw } or { error }.
async function checkDelivery(talksasaRef) {
  if (!talksasaRef) return { error: 'No TalkSasa reference stored for this message' };
  if (!API_KEY) return { error: 'No TALKSASA_API_KEY configured' };
  try {
    const response = await fetch(`${BASE_URL}/sms/queue/${encodeURIComponent(talksasaRef)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.status === 'error') {
      return { error: body.message || body.error || `HTTP ${response.status}` };
    }
    const rawStatus = extractQueueStatus(body);
    const mapped = mapDlrStatus(rawStatus);
    if (mapped) {
      await db.query('UPDATE sms_logs SET status = ? WHERE talksasa_ref = ?', [mapped, talksasaRef]);
    }
    return { rawStatus, mapped, raw: body };
  } catch (err) {
    return { error: err.message };
  }
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return digits;
}

module.exports = { sendSms, sendBulk, resolveTemplate, updateDeliveryStatus, checkDelivery };
