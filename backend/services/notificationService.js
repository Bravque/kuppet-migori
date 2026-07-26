const db = require('../config/database');
const smsService = require('./smsService');
const mailerService = require('./mailerService');

// SMS is sent for BBF and scholarship status changes; general/system notifs are in-app only.
const SMS_TYPES = new Set(['bbf_claim', 'scholarship']);

// ── Editable application-notification templates ──────────────────────────────
// The BBF-claim and scholarship-application status messages. Each event has an
// admin-editable title, message (used for both the email body and the in-app
// notification) and SMS text, with {{placeholders}} and optional
// {{#var}}…{{/var}} / {{^var}}…{{/var}} sections (shown when var is set / unset).
// Defaults below reproduce the previous hardcoded wording exactly; per-key
// overrides live in the `notification_templates` table (cached in memory).
const NOTIFICATION_TEMPLATES = {
  bbf_submitted: {
    label: 'BBF claim submitted', group: 'BBF Claims',
    description: 'Sent to the member when they submit a BBF claim.',
    variables: [{ name: 'claim_number', desc: 'claim reference number' }],
    title: 'BBF Claim Submitted',
    body: 'Your claim {{claim_number}} has been submitted and is awaiting review.',
    sms: 'Dear member, your BBF claim {{claim_number}} has been submitted for review. - KUPPET Migori',
  },
  bbf_under_review: {
    label: 'BBF claim under review', group: 'BBF Claims',
    description: 'Sent when an officer starts reviewing a BBF claim.',
    variables: [{ name: 'claim_number', desc: 'claim reference number' }],
    title: 'BBF Claim Under Review',
    body: 'Your BBF claim {{claim_number}} is now under review by the welfare desk. You will be notified once a decision is made.',
    sms: 'Dear member, your BBF claim {{claim_number}} is now UNDER REVIEW. - KUPPET Migori',
  },
  bbf_approved: {
    label: 'BBF claim approved', group: 'BBF Claims',
    description: 'Sent when a BBF claim is approved. {{amount}} is shown only if an approved amount was entered.',
    variables: [{ name: 'claim_number', desc: 'claim reference number' }, { name: 'amount', desc: 'approved amount, formatted (optional)' }],
    title: 'BBF Claim Approved',
    body: 'Your BBF claim {{claim_number}} has been approved{{#amount}}. Approved amount: KES {{amount}}{{/amount}}.',
    sms: 'Dear member, your BBF claim {{claim_number}} has been APPROVED{{#amount}}. Amount: KES {{amount}}{{/amount}}. Payment will be processed shortly. - KUPPET Migori',
  },
  bbf_rejected: {
    label: 'BBF claim not approved', group: 'BBF Claims',
    description: 'Sent when a BBF claim is rejected. {{reason}} is shown only if a reason was entered.',
    variables: [{ name: 'claim_number', desc: 'claim reference number' }, { name: 'reason', desc: 'rejection reason (optional)' }],
    title: 'BBF Claim Not Approved',
    body: 'Your BBF claim {{claim_number}} could not be approved at this time. {{#reason}}Reason: {{reason}}{{/reason}}',
    sms: 'Dear member, your BBF claim {{claim_number}} was not approved. {{#reason}}Reason: {{reason}}{{/reason}}{{^reason}}Contact welfare desk for details.{{/reason}}  - KUPPET Migori',
  },
  bbf_paid: {
    label: 'BBF claim payment processed', group: 'BBF Claims',
    description: 'Sent when a BBF claim payment is processed. {{reference}} is shown only if a payment reference was entered.',
    variables: [{ name: 'claim_number', desc: 'claim reference number' }, { name: 'reference', desc: 'payment reference (optional)' }],
    title: 'BBF Claim Payment Processed',
    body: 'Your BBF claim {{claim_number}} payment has been processed{{#reference}} (Ref: {{reference}}){{/reference}}.',
    sms: 'Dear member, payment for your BBF claim {{claim_number}} has been PROCESSED{{#reference}}. Ref: {{reference}}{{/reference}}. - KUPPET Migori',
  },
  scholarship_submitted: {
    label: 'Scholarship application submitted', group: 'Scholarships',
    description: 'Sent to the member when they submit a scholarship application.',
    variables: [{ name: 'app_number', desc: 'application reference number' }, { name: 'scholarship_title', desc: 'scholarship title' }],
    title: 'Scholarship Application Submitted',
    body: 'Your application {{app_number}} for "{{scholarship_title}}" has been submitted and is awaiting review.',
    sms: 'Dear member, your scholarship application {{app_number}} has been submitted for review. - KUPPET Migori',
  },
  scholarship_under_review: {
    label: 'Scholarship application under review', group: 'Scholarships',
    description: 'Sent when an officer starts reviewing a scholarship application.',
    variables: [{ name: 'scholarship_title', desc: 'scholarship title' }, { name: 'applicant_name', desc: "applicant's name" }],
    title: 'Scholarship Application Under Review',
    body: 'Your scholarship application for "{{scholarship_title}}" ({{applicant_name}}) is now under review. You will be notified once a decision is made.',
    sms: 'Dear member, your scholarship application ({{scholarship_title}}) is now UNDER REVIEW. - KUPPET Migori',
  },
  scholarship_approved: {
    label: 'Scholarship application approved', group: 'Scholarships',
    description: 'Sent when a scholarship application is approved. {{amount}} is shown only if an award amount was entered.',
    variables: [{ name: 'scholarship_title', desc: 'scholarship title' }, { name: 'applicant_name', desc: "applicant's name" }, { name: 'amount', desc: 'awarded amount, formatted (optional)' }],
    title: 'Scholarship Application Approved',
    body: 'Your scholarship application for "{{scholarship_title}}" ({{applicant_name}}) has been approved.{{#amount}} Awarded amount: KES {{amount}}.{{/amount}}',
    sms: 'Dear member, the scholarship application for {{applicant_name}} ({{scholarship_title}}) has been APPROVED{{#amount}}. Award: KES {{amount}}{{/amount}}. - KUPPET Migori',
  },
  scholarship_paid: {
    label: 'Scholarship payment processed', group: 'Scholarships',
    description: 'Sent when a scholarship award payment is processed. {{amount}}/{{reference}} shown only if entered.',
    variables: [{ name: 'scholarship_title', desc: 'scholarship title' }, { name: 'applicant_name', desc: "applicant's name" }, { name: 'amount', desc: 'awarded amount, formatted (optional)' }, { name: 'reference', desc: 'payment reference (optional)' }],
    title: 'Scholarship Payment Processed',
    body: 'Your scholarship award for "{{scholarship_title}}" ({{applicant_name}}) has been paid{{#amount}}. Amount: KES {{amount}}{{/amount}}{{#reference}} (Ref: {{reference}}){{/reference}}.',
    sms: 'Dear member, your scholarship award for {{scholarship_title}} has been PAID{{#amount}}. Amount: KES {{amount}}{{/amount}}{{#reference}}. Ref: {{reference}}{{/reference}}. - KUPPET Migori',
  },
  scholarship_rejected: {
    label: 'Scholarship application unsuccessful', group: 'Scholarships',
    description: 'Sent when a scholarship application is rejected. {{reason}} is shown only if a reason was entered.',
    variables: [{ name: 'scholarship_title', desc: 'scholarship title' }, { name: 'applicant_name', desc: "applicant's name" }, { name: 'reason', desc: 'reason (optional)' }],
    title: 'Scholarship Application Unsuccessful',
    body: 'Your scholarship application for "{{scholarship_title}}" ({{applicant_name}}) was not successful this time.{{#reason}} Reason: {{reason}}{{/reason}}',
    sms: 'Dear member, the scholarship application for {{applicant_name}} ({{scholarship_title}}) was not successful this time. {{#reason}}Reason: {{reason}}{{/reason}}{{^reason}}Contact the office for details.{{/reason}} - KUPPET Migori',
  },
};

// In-memory override cache: event_key → { title, body, sms }.
const notificationCache = new Map();

// Render {{placeholders}} and {{#var}}…{{/var}} / {{^var}}…{{/var}} sections.
// Output is plain text (email/in-app escape later, SMS is plain).
function renderTemplate(tpl, vars) {
  const has = (k) => k in vars && vars[k] != null && String(vars[k]).trim() !== '';
  let out = String(tpl).replace(/\{\{([#^])\s*(\w+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g,
    (m, kind, key, inner) => ((kind === '#' ? has(key) : !has(key)) ? inner : ''));
  return out.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? String(vars[k] == null ? '' : vars[k]) : m));
}

// Build { title, body, sms } for an event, applying any admin override.
function renderNotification(eventKey, vars = {}) {
  const def = NOTIFICATION_TEMPLATES[eventKey];
  if (!def) throw new Error('Unknown notification template: ' + eventKey);
  const ov = notificationCache.get(eventKey) || {};
  return {
    title: renderTemplate(ov.title != null ? ov.title : def.title, vars),
    body: renderTemplate(ov.body != null ? ov.body : def.body, vars),
    // SMS wording is not editable from the (email-only) admin UI — always the
    // code default, so the text-message channel stays under code control.
    sms: renderTemplate(def.sms, vars),
  };
}

// Refresh the override cache from the DB. Safe before the table exists.
async function loadNotificationCache() {
  try {
    const [rows] = await db.query('SELECT template_key, title, body, sms FROM notification_templates');
    notificationCache.clear();
    for (const r of rows) notificationCache.set(r.template_key, { title: r.title, body: r.body, sms: r.sms });
  } catch (err) {
    console.warn('[notif] overrides not loaded (using defaults):', err.message);
  }
}

async function createNotification({ memberId, type, title, body, referenceId = null, smsMessage = null, email = false, adminId = 1 }) {
  await db.query(
    `INSERT INTO notifications (member_id, type, title, body, reference_id)
     VALUES (?, ?, ?, ?, ?)`,
    [memberId, type, title, body || null, referenceId]
  );

  const wantsSms = SMS_TYPES.has(type) && smsMessage;
  if (!wantsSms && !email) return;

  // Fetch member contact details once for whichever channels are requested.
  const [[member]] = await db.query('SELECT full_name, phone, email FROM members WHERE id = ?', [memberId]);
  if (!member) return;

  if (wantsSms) {
    await smsService.sendSms({
      phone: member.phone,
      message: smsMessage,
      memberId,
      sentBy: adminId,
    });
  }

  // Email uses the notification title/body; mailerService fails gracefully if SMTP is unset.
  if (email && member.email) {
    const tpl = mailerService.templates.memberNotice(member.full_name, title, body);
    await mailerService.sendMail({ to: member.email, ...tpl });
  }
}

module.exports = { createNotification, NOTIFICATION_TEMPLATES, renderNotification, loadNotificationCache };
