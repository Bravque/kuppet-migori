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
  else {
    console.error(`Unknown option: ${a}`);
    console.error('Usage: node backend/scripts/create-demo-member.js [--name N] [--tsc N] [--id N] [--school N] [--sub-county N] [--year YYYY] [--cost N] [--out FILE]');
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

const sqlText = out.join('\n');
if (opts.out) {
  fs.writeFileSync(opts.out, sqlText);
  console.error(`SQL written to ${opts.out}`);
} else {
  process.stdout.write(sqlText);
}

console.error('\n──────── demo member ────────');
console.error(`  Name       : ${opts.name}`);
console.error(`  Login (TSC): ${opts.tsc}`);
console.error(`  Password   : ${opts.national_id}   (national ID — must be changed on first login)`);
console.error(`  School     : ${opts.school || '(first active school on the curated list)'}`);
console.error(`  Sub-county : ${opts.sub_county || '(from that school, else Rongo)'}`);
console.error(`  Member no. : MBR-${opts.year}-<next member_seq>  (counter advances in the transaction)`);
console.error('  Status     : approved · must_change_password=1 · onboarding_complete=0');
console.error('─────────────────────────────');
console.error('Next: hPanel → phpMyAdmin → u735599564_KuppetMigori44 → SQL tab → paste the file → Go.');
console.error('Then log in at https://kuppetmigori.co.ke/member/login.html');
