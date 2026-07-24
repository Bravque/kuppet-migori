const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// Absolute logo URL (email clients can't load relative paths).
const BRAND_LOGO = (process.env.APP_URL || 'https://kuppetmigori.co.ke').replace(/\/$/, '') + '/images/kuppetlogo.png';

// Wrap a body-HTML fragment in the branded KUPPET Migori email shell (logo
// header, brand band, gold accent, footer). Table-based + inline styles for
// email-client compatibility. Applied to every outgoing email in sendMail().
function brandEmail(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e6eaf2;font-family:Arial,Helvetica,sans-serif">
        <tr><td style="background:#ffffff;padding:22px 20px 14px;text-align:center">
          <img src="${BRAND_LOGO}" alt="KUPPET Migori" width="72" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none">
        </td></tr>
        <tr><td style="background:#1B3A6E;padding:12px 20px;text-align:center">
          <div style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:.4px">KUPPET MIGORI BRANCH</div>
          <div style="color:#b8cbe8;font-size:11px;margin-top:2px">Kenya Union of Post Primary Education Teachers</div>
        </td></tr>
        <tr><td style="height:3px;background:#C8962A;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:26px 30px;color:#1A202C;font-size:15px;line-height:1.65">${bodyHtml}</td></tr>
        <tr><td style="background:#f7f9fc;border-top:1px solid #e6eaf2;padding:18px 30px;text-align:center;color:#718096;font-size:12px;line-height:1.7">
          <strong style="color:#4a5568">KUPPET Migori Branch</strong><br>
          Cosade Building, 3rd Floor, Front Wing, P.O. Box 842-40400, Migori Town<br>
          <a href="tel:+254721808993" style="color:#1B3A6E;text-decoration:none">+254 721 808 993</a> &nbsp;&middot;&nbsp;
          <a href="mailto:info@kuppetmigori.co.ke" style="color:#1B3A6E;text-decoration:none">info@kuppetmigori.co.ke</a><br>
          <a href="https://whatsapp.com/channel/0029VbCDNtx23n3d4LFqbe15" style="color:#1a7340;text-decoration:none">Join our WhatsApp channel</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendMail({ to, subject, html, text, replyTo, from }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP not configured — skipping email to', to);
    return { skipped: true };
  }
  try {
    // Plain-text alt is derived from the body fragment (before the branded
    // wrapper) so it stays clean; the HTML gets the full branded shell.
    const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const info = await getTransporter().sendMail({
      // Sends via the authenticated SMTP account; `from` may override the shown
      // sender (e.g. advocacy@ for advocacy replies) on the same mail server.
      from: from || `"KUPPET Migori" <${process.env.SMTP_USER}>`,
      to,
      replyTo,
      subject,
      html: brandEmail(html),
      text: plainText,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Send failed:', err.message);
    return { success: false };
  }
}

// Escape user-supplied values before injecting them into email HTML.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Preserve line breaks from a plain-text body inside HTML.
const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

// Convert a plain-text body to safe HTML: blank line = new paragraph, single
// newline = <br>, and bare URLs / email addresses become clickable links. Used
// for the plain-text editable email templates so non-technical admins can just
// type — no HTML — and still get the polished paragraph layout.
function plainToHtml(text) {
  const linked = esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '<a href="mailto:$1">$1</a>');
  return linked
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => '<p>' + p.replace(/\r?\n/g, '<br>') + '</p>')
    .join('\n');
}

// ── Editable transactional templates ─────────────────────────────────────────
// These automated emails have an admin-editable subject + body (HTML) with
// {{placeholders}}. Defaults below are the source of truth; the admin Email
// Templates → Automated Emails page stores per-key overrides in the
// `transactional_templates` table. Overrides are cached in memory (single
// Hostinger instance) and refreshed at startup + after each save.
const TRANSACTIONAL_TEMPLATES = {
  registration_received: {
    label: 'Registration received',
    description: 'Sent to an applicant right after they register.',
    plainText: true,
    variables: [{ name: 'name', desc: "applicant's full name" }],
    subject: 'KUPPET Migori — Registration Received',
    body: `Dear {{name}},

Thank you for registering with KUPPET Migori. Your application is under review and you will be notified via SMS and email once it has been processed.

If you have any questions, contact our office at info@kuppetmigori.co.ke or call +254 721 808 993.

Regards,
Executive Secretary,
KUPPET Migori Branch`,
  },
  membership_approved: {
    label: 'Membership approved',
    description: 'Sent when an admin approves a membership application.',
    plainText: true,
    variables: [{ name: 'name', desc: "member's full name" }, { name: 'member_number', desc: 'assigned member number' }],
    subject: 'KUPPET Migori — Membership Approved',
    body: `Dear {{name}},

Congratulations! Your KUPPET Migori membership has been approved.

Your member number is: {{member_number}}

You can now log in to your member portal at https://kuppetmigori.co.ke/member/login.html

Regards,
Executive Secretary,
KUPPET Migori Branch`,
  },
  membership_rejected: {
    label: 'Membership rejected',
    description: 'Sent when an admin rejects a membership application.',
    plainText: true,
    variables: [{ name: 'name', desc: "applicant's full name" }, { name: 'reason', desc: 'rejection reason' }],
    subject: 'KUPPET Migori — Membership Application Update',
    body: `Dear {{name}},

We regret to inform you that your membership application could not be approved at this time.

Reason: {{reason}}

Please visit our office or contact us at info@kuppetmigori.co.ke for further assistance.

Regards,
Executive Secretary,
KUPPET Migori Branch`,
  },
  password_reset: {
    label: 'Password reset',
    description: 'Sent when a member requests a password reset. Not editable (security-sensitive — depends on the one-time {{reset_link}}).',
    editable: false,
    variables: [{ name: 'name', desc: "member's full name" }, { name: 'reset_link', desc: 'one-time reset URL (required)' }],
    subject: 'KUPPET Migori — Password Reset',
    body: `<p>Dear {{name}},</p>
<p>We received a request to reset the password for your KUPPET Migori member portal account. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong> and can only be used once.</p>
<p><a href="{{reset_link}}" style="display:inline-block;background:#1B3A6E;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset my password</a></p>
<p>If the button doesn't work, copy and paste this link into your browser:<br><a href="{{reset_link}}">{{reset_link}}</a></p>
<p>If you did not request this, you can safely ignore this email — your password will not change.</p>
<p>Regards,<br>Executive Secretary,<br>KUPPET Migori Branch</p>`,
  },
  contact_acknowledgement: {
    label: 'Contact form acknowledgement',
    description: 'Auto-reply sent to someone who submits the public contact form.',
    plainText: true,
    variables: [{ name: 'name', desc: "enquirer's name" }, { name: 'category', desc: 'enquiry category' }],
    subject: 'KUPPET Migori — We received your {{category}} enquiry',
    body: `Dear {{name}},

Thank you for contacting KUPPET Migori. We have received your enquiry and will respond within 2 working days.

For urgent matters, call +254 721 808 993.

Regards,
Executive Secretary,
KUPPET Migori Branch`,
  },
};

// In-memory override cache: template_key → { subject, body }. Empty until
// loadTransactionalCache() runs (and stays empty if the table doesn't exist yet).
const transactionalCache = new Map();

// Replace {{placeholders}}. Body values are HTML-escaped (user-supplied); subject
// values are left raw (plain-text header). Unknown placeholders are left intact.
function interpolate(tpl, vars, escapeValues) {
  return String(tpl).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    return escapeValues ? esc(v) : String(v == null ? '' : v);
  });
}

// Build { subject, html } for a transactional key, applying any admin override.
function renderTransactional(key, vars) {
  const def = TRANSACTIONAL_TEMPLATES[key];
  if (!def) throw new Error('Unknown transactional template: ' + key);
  const ov = transactionalCache.get(key) || {};
  const subjectTpl = ov.subject != null ? ov.subject : def.subject;
  const bodyTpl = ov.body != null ? ov.body : def.body;
  // Treat as plain text only when the template is plainText AND the body isn't
  // already authored HTML (guards any legacy HTML override saved before the
  // plain-text switch — those keep rendering as HTML).
  const looksLikeHtml = /<(p|br|div|a|strong|em|ul|ol|li|table|h[1-6])\b/i.test(bodyTpl);
  return {
    subject: interpolate(subjectTpl, vars, false),
    // Plain-text: substitute placeholders raw, then convert the whole body
    // (escaping + paragraphs + autolinks) to HTML. HTML: substitute with values
    // HTML-escaped and keep the authored HTML (e.g. password_reset's button).
    html: (def.plainText && !looksLikeHtml)
      ? plainToHtml(interpolate(bodyTpl, vars, false))
      : interpolate(bodyTpl, vars, true),
  };
}

// Refresh the override cache from the DB. Safe before the table exists (keeps
// defaults). Call at startup and after an admin saves/resets an override.
async function loadTransactionalCache() {
  try {
    const db = require('../config/database');
    const [rows] = await db.query('SELECT template_key, subject, body FROM transactional_templates');
    transactionalCache.clear();
    for (const r of rows) transactionalCache.set(r.template_key, { subject: r.subject, body: r.body });
  } catch (err) {
    console.warn('[mailer] transactional overrides not loaded (using defaults):', err.message);
  }
}

// Pre-built templates
const templates = {
  memberRegistered: (name) => renderTransactional('registration_received', { name }),

  memberApproved: (name, memberNumber) => renderTransactional('membership_approved', { name, member_number: memberNumber }),

  memberRejected: (name, reason) => renderTransactional('membership_rejected', { name, reason }),

  passwordReset: (name, link) => renderTransactional('password_reset', { name, reset_link: link }),

  // Generic member status notice — used for BBF claim & scholarship application
  // status changes (submitted, under review, approved, rejected, paid). The
  // title/body come straight from the in-app notification so the wording stays
  // in one place.
  memberNotice: (name, title, body) => ({
    subject: `KUPPET Migori — ${esc(title)}`,
    html: `<p>Dear ${esc(name || 'Member')},</p>
<p>${nl2br(body || title)}</p>
<p>You can view the details anytime in your member portal at <a href="https://kuppetmigori.co.ke/member/login.html">kuppetmigori.co.ke/member/login.html</a>.</p>
<p>Regards,<br>Executive Secretary,<br>KUPPET Migori Branch</p>`,
  }),

  // Admin-composed email (Communications → Send Email): individual, bulk, or
  // group broadcast. Subject is plain text (email header); body is wrapped in a
  // branded greeting/sign-off. Name defaults to "Member" for anonymous sends.
  adminEmail: (name, subject, body) => ({
    subject: String(subject || 'A message from KUPPET Migori'),
    html: `<p>Dear ${esc(name || 'Member')},</p>
<p>${nl2br(body)}</p>
<p>Regards,<br>Executive Secretary,<br>KUPPET Migori Branch</p>`,
  }),

  contactAutoReply: (name, category) => renderTransactional('contact_acknowledgement', { name, category }),

  // Sent to the branch inbox whenever a new enquiry is submitted. replyTo is set
  // to the enquirer's address so staff can reply straight from their mail client.
  contactStaffAlert: (c) => ({
    subject: `New ${esc(c.category || 'general')} enquiry from ${esc(c.name)}`,
    html: `<p>A new contact enquiry was submitted on kuppetmigori.co.ke:</p>
<table cellpadding="4" style="font-size:0.95rem">
  <tr><td><strong>Name</strong></td><td>${esc(c.name)}</td></tr>
  <tr><td><strong>Email</strong></td><td><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></td></tr>
  <tr><td><strong>Phone</strong></td><td>${esc(c.phone) || '—'}</td></tr>
  <tr><td><strong>Category</strong></td><td>${esc(c.category || 'general')}</td></tr>
  <tr><td><strong>Subject</strong></td><td>${esc(c.subject) || '—'}</td></tr>
</table>
<p><strong>Message:</strong></p>
<p>${nl2br(c.message)}</p>
<p style="color:#718096;font-size:0.85rem">Reply from the admin Contact Inbox, or just reply to this email to reach ${esc(c.name)} directly.</p>`,
  }),

  // Sent to the enquirer when an admin replies from the Contact Inbox.
  contactReply: (name, originalSubject, originalMessage, replyBody) => ({
    subject: `KUPPET Migori — Re: ${esc(originalSubject || 'Your enquiry')}`,
    html: `<p>Dear ${esc(name)},</p>
<p>${nl2br(replyBody)}</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:1.25rem 0">
<p style="color:#718096;font-size:0.85rem">In reply to your message:<br><em>${nl2br(originalMessage)}</em></p>
<p>Regards,<br>Executive Secretary,<br>KUPPET Migori Branch</p>`,
  }),
};

module.exports = { sendMail, templates, TRANSACTIONAL_TEMPLATES, loadTransactionalCache };
