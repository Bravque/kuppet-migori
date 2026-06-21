/**
 * Quick TalkSasa SMS sanity check.
 * Usage:  node backend/scripts/test-sms.js +2547XXXXXXXX "Your message"
 * Reads TALKSASA_* from the environment (.env locally, or hPanel env vars on
 * the server) and sends one SMS via the same service the app uses. Prints the
 * real result/error so you can confirm the API key, base URL and sender ID
 * are correct before relying on the portal.
 */
require('dotenv').config();
const sms = require('../services/smsService');

(async () => {
  const to = process.argv[2];
  const message = process.argv.slice(3).join(' ') || 'KUPPET Migori — test SMS';
  if (!to) {
    console.error('Usage: node backend/scripts/test-sms.js +2547XXXXXXXX "message"');
    process.exit(1);
  }

  console.log('TALKSASA_BASE_URL :', process.env.TALKSASA_BASE_URL || '(default https://bulksms.talksasa.com/api/v3)');
  console.log('TALKSASA_API_KEY  :', process.env.TALKSASA_API_KEY ? '(set)' : '(NOT set)');
  console.log('TALKSASA_SENDER_ID:', process.env.TALKSASA_SENDER_ID || '(default KUPPET)');
  console.log('Sending to', to, '…\n');

  const result = await sms.sendSms({ phone: to, message, sentBy: 1 });

  console.log('Result:', result);
  if (result.status === 'sent')        console.log('\n→ Sent. Check the handset (and TalkSasa dashboard).');
  else if (result.status === 'queued') console.log('\n→ Queued: no TALKSASA_API_KEY configured.');
  else                                 console.log('\n→ FAILED:', result.error || '(no error message returned)');
  process.exit(0);
})();
