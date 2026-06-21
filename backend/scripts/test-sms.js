/**
 * TalkSasa SMS diagnostic.
 * Usage:  node backend/scripts/test-sms.js +2547XXXXXXXX "Your message"
 *
 * Makes the RAW TalkSasa v3 calls and prints the full responses, so when the
 * portal says "sent" but no SMS arrives you can see exactly what TalkSasa did
 * (sender-ID status, cost, credit balance, delivery status, etc.).
 */
require('dotenv').config();

const BASE_URL  = (process.env.TALKSASA_BASE_URL || 'https://bulksms.talksasa.com/api/v3').replace(/\/+$/, '');
const API_KEY   = process.env.TALKSASA_API_KEY || '';
const SENDER_ID = process.env.TALKSASA_SENDER_ID || 'KUPPET';

function normalizePhone(phone) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) return '254' + d.slice(1);
  if (d.startsWith('254')) return d;
  return d;
}

async function call(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data; const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { httpStatus: res.status, ok: res.ok, data };
}

(async () => {
  const to = process.argv[2];
  const message = process.argv.slice(3).join(' ') || 'KUPPET Migori — test SMS';
  if (!to) { console.error('Usage: node backend/scripts/test-sms.js +2547XXXXXXXX "message"'); process.exit(1); }

  console.log('BASE_URL  :', BASE_URL);
  console.log('API_KEY   :', API_KEY ? `set (${API_KEY.slice(0,4)}…${API_KEY.slice(-4)})` : 'NOT set');
  console.log('SENDER_ID :', SENDER_ID);
  console.log('recipient :', normalizePhone(to), '\n');

  if (!API_KEY) { console.log('No API key — set TALKSASA_API_KEY first.'); process.exit(1); }

  // 1. Credit balance (helps spot a zero-balance account that still 200s on send)
  try {
    console.log('— GET /balance —');
    console.log(JSON.stringify(await call('GET', '/balance'), null, 2), '\n');
  } catch (e) { console.log('balance check error:', e.message, '\n'); }

  // 2. Send
  try {
    console.log('— POST /sms/send —');
    const r = await call('POST', '/sms/send', {
      recipient: normalizePhone(to),
      sender_id: SENDER_ID,
      type: 'plain',
      message,
    });
    console.log(JSON.stringify(r, null, 2));
    console.log('\nIf data.status is "success" but nothing arrives, the usual causes are:');
    console.log('  • sender_id not approved on your TalkSasa account');
    console.log('  • zero SMS credit (see balance above)');
    console.log('  • number not in 2547XXXXXXXX format / on DND');
  } catch (e) { console.log('send error:', e.message); }

  process.exit(0);
})();
