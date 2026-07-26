const db = require('../config/database');

// Enforce the curated `schools` list as the source of truth for a member's
// school. Returns:
//   { ok: true,  name }  → store this (canonical) name
//   { ok: false, name }  → the input isn't on the active list AND the list is
//                          populated, so the caller should reject it
// Safety: if the schools table is empty or missing (e.g. migration #25 not yet
// run on live), it returns { ok: true } with the input as-is, so enforcement can
// never lock everyone out before the list exists.
async function resolveSchool(rawName) {
  const name = (rawName || '').trim();
  try {
    const [[match]] = await db.query('SELECT name FROM schools WHERE name = ? AND is_active = 1 LIMIT 1', [name]);
    if (match) return { ok: true, name: match.name };          // on the list → use canonical spelling
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM schools WHERE is_active = 1');
    if (n > 0) return { ok: false, name };                     // list governs and this isn't on it → reject
    return { ok: true, name };                                 // list empty → don't block (deploy-safe)
  } catch (err) {
    return { ok: true, name };                                 // table missing → don't block
  }
}

const OFF_LIST_MESSAGE = 'Please select your school from the list. If your school is not listed, contact the KUPPET Migori office to have it added.';

module.exports = { resolveSchool, OFF_LIST_MESSAGE };
