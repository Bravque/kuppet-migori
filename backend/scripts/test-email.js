/**
 * Quick SMTP sanity check.
 * Usage:  node backend/scripts/test-email.js you@example.com
 * Reads SMTP_* from the environment (.env locally, or hPanel env vars on the server)
 * and sends one test email. Prints the result so you can confirm SMTP works
 * before relying on the password-reset flow.
 */
require('dotenv').config();
const mailer = require('../services/mailerService');

(async () => {
  const to = process.argv[2];
  if (!to) {
    console.error('Provide a recipient: node backend/scripts/test-email.js you@example.com');
    process.exit(1);
  }

  console.log('SMTP_HOST:', process.env.SMTP_HOST || '(not set)');
  console.log('SMTP_PORT:', process.env.SMTP_PORT || '(not set)');
  console.log('SMTP_USER:', process.env.SMTP_USER || '(not set)');
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '(set)' : '(not set)');
  console.log('Sending test email to', to, '…');

  const result = await mailer.sendMail({
    to,
    subject: 'KUPPET Migori — SMTP test',
    html: '<p>This is a test email confirming SMTP is configured correctly for KUPPET Migori.</p>',
  });

  console.log('Result:', result);
  if (result.skipped) console.log('→ SMTP env vars are missing, so nothing was sent.');
  else if (result.success) console.log('→ Success. Check the inbox (and spam folder).');
  else console.log('→ Failed:', result.error);
  process.exit(0);
})();
