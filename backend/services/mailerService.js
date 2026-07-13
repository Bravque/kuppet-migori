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

async function sendMail({ to, subject, html, text, replyTo, from }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP not configured — skipping email to', to);
    return { skipped: true };
  }
  try {
    const info = await getTransporter().sendMail({
      // Sends via the authenticated SMTP account; `from` may override the shown
      // sender (e.g. advocacy@ for advocacy replies) on the same mail server.
      from: from || `"KUPPET Migori" <${process.env.SMTP_USER}>`,
      to,
      replyTo,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
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

// Pre-built templates
const templates = {
  memberRegistered: (name) => ({
    subject: 'KUPPET Migori — Registration Received',
    html: `<p>Dear ${esc(name)},</p>
<p>Thank you for registering with KUPPET Migori. Your application is under review and you will be notified via SMS and email once it has been processed.</p>
<p>If you have any questions, contact our office at <a href="mailto:info@kuppetmigori.co.ke">info@kuppetmigori.co.ke</a> or call +254 721 808 993.</p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

  memberApproved: (name, memberNumber) => ({
    subject: 'KUPPET Migori — Membership Approved',
    html: `<p>Dear ${esc(name)},</p>
<p>Congratulations! Your KUPPET Migori membership has been <strong>approved</strong>.</p>
<p>Your member number is: <strong>${esc(memberNumber)}</strong></p>
<p>You can now log in to your member portal at <a href="https://kuppetmigori.co.ke/member/login.html">kuppetmigori.co.ke/member/login.html</a></p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

  memberRejected: (name, reason) => ({
    subject: 'KUPPET Migori — Membership Application Update',
    html: `<p>Dear ${esc(name)},</p>
<p>We regret to inform you that your membership application could not be approved at this time.</p>
<p><strong>Reason:</strong> ${esc(reason)}</p>
<p>Please visit our office or contact us at info@kuppetmigori.co.ke for further assistance.</p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

  passwordReset: (name, link) => ({
    subject: 'KUPPET Migori — Password Reset',
    html: `<p>Dear ${esc(name)},</p>
<p>We received a request to reset the password for your KUPPET Migori member portal account. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong> and can only be used once.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#1B3A6E;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset my password</a></p>
<p>If the button doesn't work, copy and paste this link into your browser:<br><a href="${esc(link)}">${esc(link)}</a></p>
<p>If you did not request this, you can safely ignore this email — your password will not change.</p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

  // Generic member status notice — used for BBF claim & scholarship application
  // status changes (submitted, under review, approved, rejected, paid). The
  // title/body come straight from the in-app notification so the wording stays
  // in one place.
  memberNotice: (name, title, body) => ({
    subject: `KUPPET Migori — ${esc(title)}`,
    html: `<p>Dear ${esc(name || 'Member')},</p>
<p>${nl2br(body || title)}</p>
<p>You can view the details anytime in your member portal at <a href="https://kuppetmigori.co.ke/member/login.html">kuppetmigori.co.ke/member/login.html</a>.</p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

  // Admin-composed email (Communications → Send Email): individual, bulk, or
  // group broadcast. Subject is plain text (email header); body is wrapped in a
  // branded greeting/sign-off. Name defaults to "Member" for anonymous sends.
  adminEmail: (name, subject, body) => ({
    subject: String(subject || 'A message from KUPPET Migori'),
    html: `<p>Dear ${esc(name || 'Member')},</p>
<p>${nl2br(body)}</p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

  contactAutoReply: (name, category) => ({
    subject: `KUPPET Migori — We received your ${esc(category)} enquiry`,
    html: `<p>Dear ${esc(name)},</p>
<p>Thank you for contacting KUPPET Migori. We have received your enquiry and will respond within 2 working days.</p>
<p>For urgent matters, call +254 721 808 993.</p>
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),

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
<p>Regards,<br>KUPPET Migori Branch</p>`,
  }),
};

module.exports = { sendMail, templates };
