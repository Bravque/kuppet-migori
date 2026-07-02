const { sendMail } = require('./mailerService');

// Emails an admin when the server hits a serious error (500 / uncaught exception /
// unhandled rejection). Throttled so a burst of errors can't flood the inbox, and
// fire-and-forget — it never throws, so alerting can't itself break a request.
//
// Recipient: ALERT_EMAIL → CONTACT_EMAIL → SMTP_USER (first one set). If none is set
// or SMTP is unconfigured, it silently no-ops (matches mailerService behaviour).

const THROTTLE_MS = 10 * 60 * 1000; // at most one alert per 10 minutes
let lastAlertAt = 0;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendErrorAlert(subject, detail) {
  try {
    const to = process.env.ALERT_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER;
    if (!to) return;

    const now = Date.now();
    if (now - lastAlertAt < THROTTLE_MS) return; // throttled — drop this one
    lastAlertAt = now;

    await sendMail({
      to,
      subject: `[KUPPET Migori ALERT] ${subject}`,
      html: `<p>A server error occurred on <strong>${esc(process.env.APP_URL || 'KUPPET Migori')}</strong> `
        + `at ${new Date().toISOString()} (env: ${esc(process.env.NODE_ENV || 'development')}).</p>`
        + `<p>Further alerts are suppressed for ${THROTTLE_MS / 60000} minutes to avoid flooding — `
        + `check the server logs for the full picture.</p>`
        + `<pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow:auto">${esc(detail)}</pre>`,
    });
  } catch (_) { /* alerting must never throw */ }
}

module.exports = { sendErrorAlert };
