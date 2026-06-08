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

async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP not configured — skipping email to', to);
    return { skipped: true };
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"KUPPET Migori" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Pre-built templates
const templates = {
  memberRegistered: (name) => ({
    subject: 'KUPPET Migori — Registration Received',
    html: `<p>Dear ${name},</p>
<p>Thank you for registering with KUPPET Migori. Your application is under review and you will be notified via SMS and email once it has been processed.</p>
<p>If you have any questions, contact our office at <a href="mailto:info@kuppetmigori.co.ke">info@kuppetmigori.co.ke</a> or call +254 721 808 993.</p>
<p>Regards,<br>KUPPET Migori Branch Secretariat</p>`,
  }),

  memberApproved: (name, memberNumber) => ({
    subject: 'KUPPET Migori — Membership Approved',
    html: `<p>Dear ${name},</p>
<p>Congratulations! Your KUPPET Migori membership has been <strong>approved</strong>.</p>
<p>Your member number is: <strong>${memberNumber}</strong></p>
<p>You can now log in to your member portal at <a href="https://kuppetmigori.co.ke/member/login.html">kuppetmigori.co.ke/member/login.html</a></p>
<p>Regards,<br>KUPPET Migori Branch Secretariat</p>`,
  }),

  memberRejected: (name, reason) => ({
    subject: 'KUPPET Migori — Membership Application Update',
    html: `<p>Dear ${name},</p>
<p>We regret to inform you that your membership application could not be approved at this time.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>Please visit our office or contact us at info@kuppetmigori.co.ke for further assistance.</p>
<p>Regards,<br>KUPPET Migori Branch Secretariat</p>`,
  }),

  contactAutoReply: (name, category) => ({
    subject: `KUPPET Migori — We received your ${category} enquiry`,
    html: `<p>Dear ${name},</p>
<p>Thank you for contacting KUPPET Migori. We have received your enquiry and will respond within 2 working days.</p>
<p>For urgent matters, call +254 721 808 993.</p>
<p>Regards,<br>KUPPET Migori Branch Secretariat</p>`,
  }),
};

module.exports = { sendMail, templates };
