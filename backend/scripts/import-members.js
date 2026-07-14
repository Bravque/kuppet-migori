#!/usr/bin/env node
/**
 * Offline member importer — reads an .xlsx roster and emits a .sql file you
 * paste/import into phpMyAdmin. No DB connection is made, so it works around
 * Hostinger's remote-MySQL / nologin-SSH limits.
 *
 *   node backend/scripts/import-members.js <file.xlsx> [options] > members-import.sql
 *
 * Options:
 *   --start-seq N    Current value of settings.member_seq on the live DB
 *                    (look it up once in phpMyAdmin). New member numbers start
 *                    at N+1. Default 0.
 *   --year YYYY      Year used in MBR-YYYY-NNNNNN. Default: current year.
 *   --cost N         bcrypt cost for the default passwords. Default 10 (matches app).
 *   --out FILE       Write SQL to FILE instead of stdout.
 *
 * Imported members are ACTIVE (status='approved') with their **national ID as
 * the default password** and must_change_password=1 + onboarding_complete=0, so
 * the app forces them to set a new password and complete their profile on first
 * login. Run backend/config/migration-member-import.sql on the DB first.
 *
 * Sheet mapping (KUPPET Migori "pk" roster):
 *   Officer's Name  -> full_name        (required)
 *   Payroll-Num     -> tsc_number + employment_number   (required; login id)
 *   ID-Number       -> national_id + default password   (required)
 *   Station-Name    -> school_name
 *   Work-SubCounty  -> sub_county
 *   Tel / Sno / Station-Code -> ignored (Tel is corrupted in the source)
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { startSeq: 0, year: new Date().getFullYear(), cost: 10, out: null, file: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--start-seq') opts.startSeq = parseInt(argv[++i], 10) || 0;
  else if (a === '--year') opts.year = parseInt(argv[++i], 10) || opts.year;
  else if (a === '--cost') opts.cost = parseInt(argv[++i], 10) || 10;
  else if (a === '--out') opts.out = argv[++i];
  else if (!a.startsWith('--')) opts.file = a;
}
if (!opts.file) {
  console.error('Usage: node backend/scripts/import-members.js <file.xlsx> [--start-seq N] [--year YYYY] [--cost N] [--out FILE]');
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────
// Pull a plain string out of any exceljs cell value shape.
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v.hyperlink !== undefined) return String(v.hyperlink);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }
  return String(v);
}
const clean = (s) => cellText(s).trim();
// MySQL string literal (default sql_mode: backslash is an escape char).
const sql = (s) => (s === null || s === undefined)
  ? 'NULL'
  : `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

// Match a header row to our fields by fuzzy keyword.
function mapHeaders(headerCells) {
  const idx = {};
  headerCells.forEach((h, i) => {
    const k = clean(h).toLowerCase().replace(/[^a-z]/g, '');
    if (/officer.?s?name|fullname|^name$/.test(k)) idx.name = i;
    else if (/payroll|tsc/.test(k)) idx.tsc = i;
    else if (/idnumber|nationalid|^id$/.test(k)) idx.national_id = i;
    else if (/stationname|school/.test(k)) idx.school = i;
    else if (/subcounty/.test(k)) idx.sub_county = i;
  });
  return idx;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(opts.file));
  const ws = wb.worksheets[0];

  // Header row = first non-empty row.
  let headerRowNum = 1;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (ws.getRow(r).values.some(v => clean(v))) { headerRowNum = r; break; }
  }
  const headerRow = ws.getRow(headerRowNum);
  const headerCells = [];
  for (let c = 1; c <= ws.columnCount; c++) headerCells[c - 1] = headerRow.getCell(c).value;
  const map = mapHeaders(headerCells);

  const missing = ['name', 'tsc', 'national_id'].filter(f => map[f] === undefined);
  if (missing.length) {
    console.error(`ERROR: could not find columns for: ${missing.join(', ')}`);
    console.error(`Detected headers: ${headerCells.map(clean).join(' | ')}`);
    process.exit(1);
  }

  const rows = [];
  const skipped = [];
  const seenTsc = new Set();
  const seenId = new Set();
  let seq = opts.startSeq;

  const totalDataRows = ws.rowCount - headerRowNum;
  let processed = 0;

  for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (f) => map[f] === undefined ? '' : clean(row.getCell(map[f] + 1).value);

    const full_name = get('name');
    const tsc = get('tsc');
    const national_id = get('national_id');
    const school = get('school');
    const sub_county = get('sub_county');

    if (!full_name && !tsc && !national_id) continue; // blank row
    if (!full_name) { skipped.push([r, 'missing name']); continue; }
    if (!tsc)       { skipped.push([r, 'missing Payroll/TSC number']); continue; }
    if (!national_id) { skipped.push([r, 'missing ID number (password source)']); continue; }
    if (seenTsc.has(tsc)) { skipped.push([r, `duplicate TSC ${tsc} in sheet`]); continue; }
    if (seenId.has(national_id)) { skipped.push([r, `duplicate ID ${national_id} in sheet`]); continue; }

    seenTsc.add(tsc);
    seenId.add(national_id);
    seq += 1;

    const memberNumber = `MBR-${opts.year}-${String(seq).padStart(6, '0')}`;
    const password = bcrypt.hashSync(national_id, opts.cost);

    rows.push({
      member_number: memberNumber,
      full_name,
      tsc_number: tsc,
      national_id,
      employment_number: tsc,
      school_name: school || null,
      sub_county: sub_county || null,
      password,
    });

    processed++;
    if (processed % 500 === 0) console.error(`  …hashed ${processed}/${totalDataRows}`);
  }

  // ── emit SQL ──────────────────────────────────────────────────────────────
  const out = [];
  out.push('-- KUPPET Migori — bulk member import');
  out.push(`-- Generated ${new Date().toISOString()} from ${path.basename(opts.file)}`);
  out.push(`-- ${rows.length} members, member numbers MBR-${opts.year}-${String(opts.startSeq + 1).padStart(6, '0')} … ${String(seq).padStart(6, '0')}`);
  out.push('-- Run migration-member-import.sql FIRST. Default password = national ID; forced change on first login.');
  out.push('');
  out.push('START TRANSACTION;');
  out.push('');

  const COLS = '(member_number, full_name, tsc_number, national_id, employment_number, school_name, sub_county, password, status, must_change_password, onboarding_complete, approved_at)';
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    out.push(`INSERT IGNORE INTO members ${COLS} VALUES`);
    const values = chunk.map(m =>
      `  (${sql(m.member_number)}, ${sql(m.full_name)}, ${sql(m.tsc_number)}, ${sql(m.national_id)}, ` +
      `${sql(m.employment_number)}, ${sql(m.school_name)}, ${sql(m.sub_county)}, ${sql(m.password)}, ` +
      `'approved', 1, 0, NOW())`
    );
    out.push(values.join(',\n') + ';');
    out.push('');
  }

  if (rows.length) {
    out.push('-- Advance the member-number counter so future registrations continue cleanly.');
    out.push(`UPDATE settings SET setting_value = '${seq}' WHERE setting_key = 'member_seq' AND CAST(setting_value AS UNSIGNED) < ${seq};`);
    out.push('');
  }
  out.push('COMMIT;');
  out.push('');

  const sqlText = out.join('\n');
  if (opts.out) {
    fs.writeFileSync(opts.out, sqlText);
    console.error(`\nSQL written to ${opts.out}`);
  } else {
    process.stdout.write(sqlText);
  }

  // ── summary to stderr ─────────────────────────────────────────────────────
  console.error('\n──────── import summary ────────');
  console.error(`  Ready to insert : ${rows.length}`);
  console.error(`  Skipped         : ${skipped.length}`);
  if (skipped.length) {
    const shown = skipped.slice(0, 25);
    shown.forEach(([r, why]) => console.error(`    row ${r}: ${why}`));
    if (skipped.length > shown.length) console.error(`    …and ${skipped.length - shown.length} more`);
  }
  console.error(`  Member numbers  : MBR-${opts.year}-${String(opts.startSeq + 1).padStart(6, '0')} … MBR-${opts.year}-${String(seq).padStart(6, '0')}`);
  console.error('  Default password: each member\'s national ID (forced change on first login)');
  console.error('────────────────────────────────');
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
