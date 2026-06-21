const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const mailerService = require('../services/mailerService');

// ── Sequence number generator (atomic) ───────────────────────────────────────
async function nextSeq(key, prefix) {
  await db.query(
    `UPDATE settings SET setting_value = LAST_INSERT_ID(CAST(setting_value AS UNSIGNED) + 1) WHERE setting_key = ?`,
    [key]
  );
  const [[{ n }]] = await db.query('SELECT LAST_INSERT_ID() AS n');
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(n).padStart(6, '0')}`;
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
      school_name, sub_county, school_category,
    } = req.body;

    // Uniqueness checks
    const [[byTsc]] = await db.query('SELECT id FROM members WHERE tsc_number = ?', [tsc_number]);
    if (byTsc) return res.status(409).json({ success: false, message: 'TSC number already registered' });

    const [[byEmail]] = await db.query('SELECT id FROM members WHERE email = ?', [email.toLowerCase()]);
    if (byEmail) return res.status(409).json({ success: false, message: 'Email already registered' });

    const [[byNatId]] = await db.query('SELECT id FROM members WHERE national_id = ?', [national_id]);
    if (byNatId) return res.status(409).json({ success: false, message: 'National ID already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const memberNumber = await nextSeq('member_seq', 'MBR');

    // Handle uploaded files
    const passportPhotoUrl = req.files?.passport_photo?.[0]
      ? `/uploads/members/${req.files.passport_photo[0].filename}`
      : null;
    const nationalIdUrl = req.files?.national_id_scan?.[0]
      ? `/uploads/members/${req.files.national_id_scan[0].filename}`
      : null;

    await db.query(
      `INSERT INTO members
         (member_number, full_name, tsc_number, national_id, employment_number, phone, email,
          password, gender, date_of_birth, school_name, sub_county, school_category, passport_photo_url, national_id_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberNumber, full_name, tsc_number, national_id, employment_number || null,
       phone, email.toLowerCase(), hashedPassword, gender, date_of_birth,
       school_name, sub_county, school_category, passportPhotoUrl, nationalIdUrl]
    );

    // Send confirmation email (non-blocking)
    const { subject, html } = mailerService.templates.memberRegistered(full_name);
    mailerService.sendMail({ to: email, subject, html }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Registration submitted. Your application will be reviewed by an administrator.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
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

  const [[member]] = await db.query(
    'SELECT id, full_name, member_number, email, password, status, failed_login_attempts, locked_until FROM members WHERE tsc_number = ?',
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
  });
}

// ── Get current member ────────────────────────────────────────────────────────
async function getMe(req, res) {
  const [[member]] = await db.query(
    `SELECT id, member_number, full_name, tsc_number, phone, email, gender, date_of_birth,
            school_name, sub_county, passport_photo_url, status, created_at
     FROM members WHERE id = ?`,
    [req.member.id]
  );
  if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
  return res.json({ success: true, data: member });
}

// ── Change password ───────────────────────────────────────────────────────────
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Old and new passwords required (min 8 chars)' });
  }
  const [[m]] = await db.query('SELECT password FROM members WHERE id = ?', [req.member.id]);
  const ok = await bcrypt.compare(oldPassword, m.password);
  if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE members SET password = ? WHERE id = ?', [hash, req.member.id]);
  return res.json({ success: true, message: 'Password updated successfully' });
}

module.exports = { register, login, getMe, changePassword, nextSeq };
