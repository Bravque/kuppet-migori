const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const mailerService = require('../services/mailerService');
const { missingProfileFields } = require('../utils/memberProfile');

// ── Sequence number generator (atomic) ───────────────────────────────────────
// LAST_INSERT_ID() is connection-scoped, so the UPDATE and the read-back MUST run
// on the SAME pooled connection — otherwise, under concurrent requests, the SELECT
// can land on a different connection and return another request's value (or 0),
// producing duplicate/wrong sequence numbers.
async function nextSeq(key, prefix) {
  const conn = await db.getConnection();
  try {
    await conn.query(
      `UPDATE settings SET setting_value = LAST_INSERT_ID(CAST(setting_value AS UNSIGNED) + 1) WHERE setting_key = ?`,
      [key]
    );
    const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() AS n');
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(n).padStart(6, '0')}`;
  } finally {
    conn.release();
  }
}

function signMemberToken(member) {
  return jwt.sign(
    { id: member.id, member_number: member.member_number, full_name: member.full_name, type: 'member' },
    process.env.JWT_MEMBER_SECRET,
    { expiresIn: process.env.JWT_MEMBER_EXPIRES_IN || '30d' }
  );
}

async function logLogin(userId, ip, ua, status) {
  try {
    await db.query(
      'INSERT INTO login_history (user_id, user_type, ip_address, user_agent, status) VALUES (?, "member", ?, ?, ?)',
      [userId, ip, ua, status]
    );
  } catch (_) {}
}

// ── Register ──────────────────────────────────────────────────────────────────
async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      full_name, tsc_number, national_id, employment_number,
      phone, email, password, gender, date_of_birth,
      school_name, sub_county, school_category, job_group,
    } = req.body;

    // Already a member (e.g. bulk-imported) with this exact TSC + national ID?
    // They have an account — send them to log in instead of erroring.
    const [[existing]] = await db.query(
      'SELECT id FROM members WHERE tsc_number = ? AND national_id = ?',
      [tsc_number, national_id]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'ACCOUNT_EXISTS',
        message: 'You already have an account. Please log in with your TSC number — your ID number is your default password.',
      });
    }

    // Uniqueness checks. A TSC number or national ID already on file means the
    // person already has an account — send them to log in (ACCOUNT_EXISTS makes
    // the register page redirect), rather than showing a dead-end error.
    const [[byTsc]] = await db.query('SELECT id FROM members WHERE tsc_number = ?', [tsc_number]);
    if (byTsc) return res.status(409).json({
      success: false,
      code: 'ACCOUNT_EXISTS',
      message: 'An account with this TSC number already exists. Please log in instead.',
    });

    const [[byNatId]] = await db.query('SELECT id FROM members WHERE national_id = ?', [national_id]);
    if (byNatId) return res.status(409).json({
      success: false,
      code: 'ACCOUNT_EXISTS',
      message: 'An account with this ID number already exists. Please log in instead.',
    });

    const [[byEmail]] = await db.query('SELECT id FROM members WHERE email = ?', [email.toLowerCase()]);
    if (byEmail) return res.status(409).json({ success: false, message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const memberNumber = await nextSeq('member_seq', 'MBR');

    await db.query(
      `INSERT INTO members
         (member_number, full_name, tsc_number, national_id, employment_number, phone, email,
          password, gender, date_of_birth, school_name, sub_county, school_category, job_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberNumber, full_name, tsc_number, national_id, employment_number || null,
       phone, email.toLowerCase(), hashedPassword, gender, date_of_birth,
       school_name, sub_county, school_category, job_group || null]
    );

    // Send confirmation email (non-blocking)
    const { subject, html } = mailerService.templates.memberRegistered(full_name);
    mailerService.sendMail({ to: email, subject, html }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Registration submitted. Your application will be reviewed by an administrator.',
    });
  } catch (err) {
    // A concurrent request can slip past the read-then-insert uniqueness checks
    // above and hit the DB unique constraint. Map that to a friendly 409 rather
    // than a generic 500.
    if (err && err.code === 'ER_DUP_ENTRY') {
      // TSC / national ID clashes mean an existing account → redirect to login.
      if (/national/i.test(err.message)) {
        return res.status(409).json({ success: false, code: 'ACCOUNT_EXISTS', message: 'An account with this ID number already exists. Please log in instead.' });
      }
      if (/tsc/i.test(err.message)) {
        return res.status(409).json({ success: false, code: 'ACCOUNT_EXISTS', message: 'An account with this TSC number already exists. Please log in instead.' });
      }
      const field = /email/i.test(err.message) ? 'Email' : 'Account';
      return res.status(409).json({ success: false, message: `${field} already registered` });
    }
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { password } = req.body;
  // Members log in with their TSC number. Accept it under `email` too, as a
  // compatibility shim for any cached older client that still posts that key.
  const tsc_number = (req.body.tsc_number || req.body.email || '').toString().trim();
  if (!tsc_number || !password) {
    return res.status(400).json({ success: false, message: 'TSC number and password required' });
  }

  const ip = req.ip || req.connection.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  try {
    const [[member]] = await db.query(
      'SELECT id, full_name, member_number, email, password, status, failed_login_attempts, locked_until, must_change_password, onboarding_complete FROM members WHERE tsc_number = ?',
      [tsc_number]
    );

    if (!member) {
      return res.status(401).json({ success: false, message: 'Invalid TSC number or password' });
    }

    // Lock check
    if (member.locked_until && new Date(member.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(member.locked_until) - Date.now()) / 60000);
      await logLogin(member.id, ip, ua, 'locked');
      return res.status(423).json({ success: false, message: `Account locked. Try again in ${remaining} minute(s).` });
    }

    // Status check
    if (member.status === 'pending_approval') {
      return res.status(403).json({ success: false, message: 'Your application is pending approval. Please wait for admin review.' });
    }
    if (member.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'Your application was not approved. Please contact the branch office.' });
    }
    if (member.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the branch office.' });
    }

    const passwordOk = await bcrypt.compare(password, member.password);
    if (!passwordOk) {
      const attempts = (member.failed_login_attempts || 0) + 1;
      const maxAttempts = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5');
      const lockMins = parseInt(process.env.LOGIN_LOCK_MINUTES || '30');
      const lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + lockMins * 60000) : null;
      await db.query('UPDATE members SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockedUntil, member.id]);
      await logLogin(member.id, ip, ua, 'failed');
      return res.status(401).json({ success: false, message: 'Invalid TSC number or password' });
    }

    await db.query('UPDATE members SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?', [member.id]);
    await logLogin(member.id, ip, ua, 'success');

    return res.json({
      success: true,
      token: signMemberToken(member),
      member: { id: member.id, full_name: member.full_name, member_number: member.member_number, email: member.email },
      must_change_password: !!member.must_change_password,
      onboarding_complete: !!member.onboarding_complete,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
}

// ── Get current member ────────────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const [[member]] = await db.query(
      `SELECT id, member_number, full_name, tsc_number, national_id, phone, email, gender, date_of_birth,
              school_name, sub_county, school_category, passport_photo_url, status, created_at,
              must_change_password, onboarding_complete
       FROM members WHERE id = ?`,
      [req.member.id]
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    const missing = missingProfileFields(member);
    // Don't leak the national ID back to the client here.
    delete member.national_id;
    return res.json({
      success: true,
      data: {
        ...member,
        must_change_password: !!member.must_change_password,
        onboarding_complete: !!member.onboarding_complete,
        profile_complete: missing.length === 0,
        missing_fields: missing,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load your profile' });
  }
}

// ── First-login forced password change ────────────────────────────────────────
// Imported members log in with their national ID as the default password and
// must_change_password = 1. This sets a real password (must differ from the ID)
// and clears the flag. No old password required — they just used it to log in.
async function firstPassword(req, res) {
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }
  try {
    const [[m]] = await db.query('SELECT national_id, must_change_password FROM members WHERE id = ?', [req.member.id]);
    if (!m) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!m.must_change_password) {
      return res.status(400).json({ success: false, message: 'Password has already been set. Use the normal change-password form.' });
    }
    if (String(newPassword).trim() === String(m.national_id).trim()) {
      return res.status(400).json({ success: false, message: 'Your new password cannot be the same as your ID number' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE members SET password = ?, must_change_password = 0 WHERE id = ?', [hash, req.member.id]);
    return res.json({ success: true, message: 'Password set successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to set password' });
  }
}

// ── Change password ───────────────────────────────────────────────────────────
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Old and new passwords required (min 8 chars)' });
  }
  try {
    const [[m]] = await db.query('SELECT password FROM members WHERE id = ?', [req.member.id]);
    const ok = await bcrypt.compare(oldPassword, m.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE members SET password = ? WHERE id = ?', [hash, req.member.id]);
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update password' });
  }
}

// ── Forgot / reset password ───────────────────────────────────────────────────
function baseUrl(req) {
  const env = process.env.APP_URL || process.env.FRONTEND_URL;
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env.replace(/\/+$/, '');
  const host = req.get('host') || 'kuppetmigori.co.ke';
  const proto = /localhost|127\.0\.0\.1/.test(host) ? req.protocol : 'https';
  return `${proto}://${host}`;
}

// Reset tokens are signed with the member's current password hash, so each link
// is single-use (it stops verifying once the password changes) — no DB column needed.
function resetSecret(passwordHash) {
  return process.env.JWT_MEMBER_SECRET + passwordHash;
}

async function forgotPassword(req, res) {
  const identifier = (req.body.tsc_number || req.body.email || req.body.identifier || '').toString().trim();
  if (!identifier) return res.status(400).json({ success: false, message: 'Enter your TSC number or email' });

  // Always respond the same way so we never reveal whether an account exists.
  const generic = { success: true, message: 'If an account matches, a password reset link has been sent to the email on file.' };

  try {
    const [[member]] = await db.query(
      'SELECT id, full_name, email, password, status FROM members WHERE tsc_number = ? OR email = ?',
      [identifier, identifier.toLowerCase()]
    );
    if (!member || !member.email || member.status === 'rejected') return res.json(generic);

    const token = jwt.sign({ id: member.id, type: 'pwreset' }, resetSecret(member.password), { expiresIn: '30m' });
    const link = `${baseUrl(req)}/member/reset-password.html?token=${encodeURIComponent(token)}`;
    const tpl = mailerService.templates.passwordReset(member.full_name, link);
    await mailerService.sendMail({ to: member.email, subject: tpl.subject, html: tpl.html });
    return res.json(generic);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not process request' });
  }
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
  if (String(password).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

  const invalid = () => res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });

  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.id) return invalid();

    const [[member]] = await db.query('SELECT id, password FROM members WHERE id = ?', [decoded.id]);
    if (!member) return invalid();

    let payload;
    try {
      payload = jwt.verify(token, resetSecret(member.password));
    } catch {
      return invalid();
    }
    if (payload.type !== 'pwreset') return invalid();

    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE members SET password = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [hash, member.id]);
    return res.json({ success: true, message: 'Password reset successful. You can now log in with your TSC number and new password.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not reset password' });
  }
}

module.exports = { register, login, getMe, firstPassword, changePassword, forgotPassword, resetPassword, nextSeq };
