#!/usr/bin/env node
/**
 * Offline demo-member generator — emits a .sql file you paste/import into
 * phpMyAdmin. No DB connection is made, so it works around Hostinger's
 * remote-MySQL / nologin-SSH limits (same approach as import-members.js).
 *
 *   node backend/scripts/create-demo-member.js [options] > demo-member.sql
 *
 * Options:
 *   --name NAME        Member's full name.       Default: Peter Ochieng Otieno
 *   --tsc NUMBER       TSC/payroll number = login identifier. Default: 784512
 *   --id NUMBER        National ID = default password.        Default: 24815673
 *   --school NAME      School. Omit to auto-pick from the live `schools` table.
 *   --sub-county NAME  Sub-county. Omit to take it from the picked school.
 *   --year YYYY        Year used in MBR-YYYY-NNNNNN. Default: current year.
 *   --cost N           bcrypt cost for the password. Default 10 (matches app).
 *   --out FILE         Write SQL to FILE instead of stdout.
 *   --reset            Emit SQL that RESETS the existing demo member (matched by
 *                      --tsc) back to its just-imported state instead of
 *                      inserting a new one: password back to the national ID,
 *                      must_change_password=1, onboarding_complete=0, and the
 *                      onboarding-filled fields cleared. Keeps the same row and
 *                      member number, so it does NOT consume another member_seq.
 *                      Use this to walk the first-login demo again.
 *
 * The demo member is created EXACTLY like a bulk-imported one: ACTIVE
 * (status='approved') with the **national ID as the default password** and
 * must_change_password=1 + onboarding_complete=0 — so logging in walks the full
 * forced first-login flow (set a new password, then complete the profile).
 * Needs migration-member-import.sql (#12) on the DB, which live already has.
 *
 * The member number is taken from the live `settings.member_seq` counter inside
 * the transaction, so the demo member gets the genuine next MBR number and the
 * counter advances — no collision with future registrations.
 */

const fs = require('fs');
const bcrypt = require('bcryptjs');

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = {
  name: 'Peter Ochieng Otieno',
  tsc: '784512',
  national_id: '24815673',
  school: null,
  sub_county: null,
  year: new Date().getFullYear(),
  cost: 10,
  out: null,
  reset: false,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--name') opts.name = argv[++i];
  else if (a === '--tsc') opts.tsc = argv[++i];
  else if (a === '--id') opts.national_id = argv[++i];
  else if (a === '--school') opts.school = argv[++i];
  else if (a === '--sub-county') opts.sub_county = argv[++i];
  else if (a === '--year') opts.year = parseInt(argv[++i], 10) || opts.year;
  else if (a === '--cost') opts.cost = parseInt(argv[++i], 10) || 10;
  else if (a === '--out') opts.out = argv[++i];
  else if (a === '--reset') opts.reset = true;
  else {
    console.error(`Unknown option: ${a}`);
    console.error('Usage: node backend/scripts/create-demo-member.js [--name N] [--tsc N] [--id N] [--school N] [--sub-county N] [--year YYYY] [--cost N] [--out FILE] [--reset]');
    process.exit(1);
  }
}
for (const f of ['name', 'tsc', 'national_id']) {
  if (!String(opts[f] || '').trim()) { console.error(`ERROR: --${f} cannot be empty`); process.exit(1); }
}

// MySQL string literal (default sql_mode: backslash is an escape char).
const sql = (s) => (s === null || s === undefined)
  ? 'NULL'
  : `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

const password = bcrypt.hashSync(String(opts.national_id), opts.cost);

function write(sqlText, summary) {
  if (opts.out) {
    fs.writeFileSync(opts.out, sqlText);
    console.error(`SQL written to ${opts.out}`);
  } else {
    process.stdout.write(sqlText);
  }
  summary.forEach((l) => console.error(l));
  console.error('Next: hPanel → phpMyAdmin → u735599564_KuppetMigori44 → SQL tab → paste the file → Go.');
  console.error('Then log in at https://kuppetmigori.co.ke/member/login.html');
}

// ── reset mode ───────────────────────────────────────────────────────────────
// Put the existing demo member back to its just-imported state so the forced
// first-login flow can be demoed again. Deliberately leaves member_number,
// school_name and sub_county alone (an imported member has those) and does not
// touch member_seq.
if (opts.reset) {
  const r = [];
  r.push('-- KUPPET Migori — RESET the demo member to its just-imported state');
  r.push(`-- Generated ${new Date().toISOString()} by backend/scripts/create-demo-member.js --reset`);
  r.push(`-- Target: members.tsc_number = ${opts.tsc}`);
  r.push(`-- After this, log in with TSC ${opts.tsc} / password ${opts.national_id} and the`);
  r.push('-- forced first-login flow (set password → complete profile) runs from the top again.');
  r.push('');
  r.push('UPDATE members SET');
  r.push(`  password             = ${sql(password)},   -- bcrypt of the national ID`);
  r.push('  must_change_password = 1,');
  r.push('  onboarding_complete  = 0,');
  r.push('  -- clear what the member filled in during onboarding');
  r.push('  phone                = NULL,');
  r.push('  email                = NULL,');
  r.push('  gender               = NULL,');
  r.push('  date_of_birth        = NULL,');
  r.push('  school_category      = NULL,');
  r.push('  job_group            = NULL,');
  r.push('  passport_photo_url   = NULL,');
  r.push('  national_id_url      = NULL,');
  r.push('  -- clear login state');
  r.push('  last_login           = NULL,');
  r.push('  failed_login_attempts = 0,');
  r.push('  locked_until         = NULL');
  r.push(`WHERE tsc_number = ${sql(opts.tsc)};`);
  r.push('');
  r.push('-- Verify (expect 1 row: must_change_password=1, onboarding_complete=0, email NULL):');
  r.push('SELECT id, member_number, full_name, tsc_number, school_name, sub_county, email,');
  r.push('       status, must_change_password, onboarding_complete');
  r.push(`FROM members WHERE tsc_number = ${sql(opts.tsc)};`);
  r.push('');
  r.push('-- OPTIONAL — also wipe anything the demo member created (claims, applications,');
  r.push('-- notifications). There are no FKs on member_id, so these must be deleted by hand.');
  r.push('-- Uncomment to run:');
  r.push(`-- SET @mid := (SELECT id FROM members WHERE tsc_number = ${sql(opts.tsc)});`);
  r.push('-- DELETE FROM bbf_claim_documents WHERE claim_id IN (SELECT id FROM bbf_claims WHERE member_id = @mid);');
  r.push('-- DELETE FROM bbf_claim_timeline  WHERE claim_id IN (SELECT id FROM bbf_claims WHERE member_id = @mid);');
  r.push('-- DELETE FROM bbf_claims WHERE member_id = @mid;');
  r.push('-- DELETE FROM scholarship_application_documents WHERE application_id IN (SELECT id FROM scholarship_applications WHERE member_id = @mid);');
  r.push('-- DELETE FROM scholarship_application_timeline  WHERE application_id IN (SELECT id FROM scholarship_applications WHERE member_id = @mid);');
  r.push('-- DELETE FROM scholarship_applications WHERE member_id = @mid;');
  r.push('-- DELETE FROM notifications WHERE member_id = @mid;');
  r.push('');

  write(r.join('\n'), [
    '\n──────── demo member RESET ────────',
    `  Target (TSC): ${opts.tsc}`,
    `  Password back to: ${opts.national_id}   (national ID — must be changed on first login)`,
    '  Flags reset : must_change_password=1 · onboarding_complete=0',
    '  Cleared     : phone, email, gender, DOB, school_category, job_group, photos, login state',
    '  Kept        : member_number, school_name, sub_county (no member_seq consumed)',
    '───────────────────────────────────',
  ]);
  process.exit(0);
}

// ── emit SQL ─────────────────────────────────────────────────────────────────
const out = [];
out.push('-- KUPPET Migori — demo member');
out.push(`-- Generated ${new Date().toISOString()} by backend/scripts/create-demo-member.js`);
out.push(`-- Login: TSC ${opts.tsc}  ·  password ${opts.national_id} (the national ID — forced change on first login)`);
out.push('-- Behaves like a bulk-imported member: approved, must_change_password=1, onboarding_complete=0.');
out.push('');
out.push('START TRANSACTION;');
out.push('');

// School: use --school if given, else the first active school on the curated
// list (so the value passes resolveSchool() when the member saves their profile).
if (opts.school) {
  out.push(`SET @school := ${sql(opts.school)};`);
} else {
  out.push('-- No --school given: take the first active school off the curated list so the');
  out.push('-- value is guaranteed valid for the member-profile school check.');
  out.push("SET @school := (SELECT name FROM schools WHERE is_active = 1 ORDER BY name LIMIT 1);");
}
if (opts.sub_county) {
  out.push(`SET @sub_county := ${sql(opts.sub_county)};`);
} else {
  out.push('SET @sub_county := (SELECT NULLIF(sub_county, \'\') FROM schools WHERE name = @school LIMIT 1);');
}
out.push("SET @sub_county := COALESCE(@sub_county, 'Rongo');  -- never insert NULL");
out.push('');

out.push('-- Take the genuine next member number and advance the counter.');
out.push("UPDATE settings SET setting_value = CAST(setting_value AS UNSIGNED) + 1 WHERE setting_key = 'member_seq';");
out.push("SET @seq := (SELECT CAST(setting_value AS UNSIGNED) FROM settings WHERE setting_key = 'member_seq');");
out.push(`SET @member_number := CONCAT('MBR-${opts.year}-', LPAD(@seq, 6, '0'));`);
out.push('');

out.push('INSERT INTO members');
out.push('  (member_number, full_name, tsc_number, national_id, employment_number,');
out.push('   school_name, sub_county, password, status, must_change_password, onboarding_complete, approved_at)');
out.push('VALUES');
out.push(`  (@member_number, ${sql(opts.name)}, ${sql(opts.tsc)}, ${sql(opts.national_id)}, ${sql(opts.tsc)},`);
out.push(`   @school, @sub_county, ${sql(password)}, 'approved', 1, 0, NOW());`);
out.push('');
out.push('COMMIT;');
out.push('');
out.push('-- Verify:');
out.push(`SELECT id, member_number, full_name, tsc_number, national_id, school_name, sub_county,`);
out.push('       status, must_change_password, onboarding_complete');
out.push(`FROM members WHERE tsc_number = ${sql(opts.tsc)};`);
out.push('');
out.push('-- To remove the demo member afterwards:');
out.push(`-- DELETE FROM members WHERE tsc_number = ${sql(opts.tsc)};`);
out.push('');

write(out.join('\n'), [
  '\n──────── demo member ────────',
  `  Name       : ${opts.name}`,
  `  Login (TSC): ${opts.tsc}`,
  `  Password   : ${opts.national_id}   (national ID — must be changed on first login)`,
  `  School     : ${opts.school || '(first active school on the curated list)'}`,
  `  Sub-county : ${opts.sub_county || '(from that school, else Rongo)'}`,
  `  Member no. : MBR-${opts.year}-<next member_seq>  (counter advances in the transaction)`,
  '  Status     : approved · must_change_password=1 · onboarding_complete=0',
  '─────────────────────────────',
]);
