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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const intEnv = (v, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : dflt; };

// Send bulk SMS to an array of recipients — **batched and throttled** so we never
// fire thousands of concurrent fetches/DB inserts at once (which would exhaust
// sockets, the 10-connection pool, and TalkSasa, and hang the request).
// Processes `batchSize` at a time (default 10, matching the DB pool) with a
// `batchDelayMs` pause between batches. Awaitable; returns an array of results.
// Each send still logs its own row to sms_logs as it completes.
async function sendBulk({ recipients, message, sentBy, templateId = null, batchSize, batchDelayMs } = {}) {
  const size  = Math.max(1, batchSize    != null ? batchSize    : intEnv(process.env.SMS_BATCH_SIZE, 10));
  const delay = Math.max(0, batchDelayMs != null ? batchDelayMs : intEnv(process.env.SMS_BATCH_DELAY_MS, 1000));
  const out = [];
  for (let i = 0; i < recipients.length; i += size) {
    const chunk = recipients.slice(i, i + size);
    const settled = await Promise.allSettled(
      chunk.map((r) => sendSms({
        phone: r.phone,
        message: resolveTemplate(message, r.vars || {}),
        memberId: r.memberId || null,
        sentBy,
        templateId,
      }))
    );
    settled.forEach((r, j) => out.push({
      phone: chunk[j].phone,
      ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    }));
    if (delay && i + size < recipients.length) await sleep(delay);
  }
  return out;
}

// Fire-and-forget batched bulk send. Returns the queued count **immediately** so
// the admin's HTTP request doesn't hang while thousands of messages go out; the
// batches then drain on the event loop and each row lands in sms_logs as it
// completes (watch the SMS Logs page for progress). Never throws — the
// background promise is `.catch`-guarded so it can't become an unhandled
// rejection. Caveat: if the Node process restarts mid-run, un-sent recipients
// are simply not sent (already-sent rows are safe in sms_logs) — resend to the
// remainder from SMS Logs if needed.
function queueBulk({ recipients, message, sentBy, templateId = null }) {
  const queued = recipients.length;
  Promise.resolve()
    .then(() => sendBulk({ recipients, message, sentBy, templateId }))
    .then((results) => {
      const sent = results.filter((r) => r.success).length;
      console.log(`[bulk-sms] background send complete: ${sent}/${results.length}`);
    })
    .catch((err) => console.error('[bulk-sms] background send failed:', err));
  return { queued };
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

module.exports = { sendSms, sendBulk, queueBulk, resolveTemplate, updateDeliveryStatus, checkDelivery };
