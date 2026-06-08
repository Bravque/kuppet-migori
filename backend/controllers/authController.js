const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../config/database');

// ── AES-256-GCM helpers for TOTP secret storage ──────────────────────────────
function encryptSecret(plain) {
  const key = getEncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptSecret(stored) {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const key = getEncKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8');
}

function getEncKey() {
  const hex = process.env.TOTP_ENCRYPTION_KEY || '0'.repeat(64);
  return Buffer.from(hex, 'hex');
}

function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
}

// ── JWT helpers ───────────────────────────────────────────────────────────────
function signAdminToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, type: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function signTempToken(userId) {
  return jwt.sign({ id: userId, type: 'admin_temp', requires2fa: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function adminLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const ip = req.ip || req.connection.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  const [[user]] = await db.query(
    'SELECT id, name, email, password, role, is_active, failed_login_attempts, locked_until FROM users WHERE email = ?',
    [email.toLowerCase().trim()]
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  // Check account lock
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    await logLogin(user.id, 'admin', ip, ua, 'locked');
    return res.status(423).json({ success: false, message: `Account locked. Try again in ${remaining} minute(s).` });
  }

  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Account is inactive' });
  }

  const passwordOk = await bcrypt.compare(password, user.password);

  if (!passwordOk) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    const maxAttempts = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5');
    const lockMins = parseInt(process.env.LOGIN_LOCK_MINUTES || '30');
    const lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + lockMins * 60000) : null;

    await db.query(
      'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
      [attempts, lockedUntil, user.id]
    );
    await logLogin(user.id, 'admin', ip, ua, 'failed');
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  // Reset failed attempts
  await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?', [user.id]);

  // Check if 2FA is enabled
  const [[twofa]] = await db.query('SELECT is_enabled FROM admin_2fa WHERE user_id = ?', [user.id]);

  if (twofa && twofa.is_enabled) {
    const tempToken = signTempToken(user.id);
    await logLogin(user.id, 'admin', ip, ua, 'success');
    return res.json({ success: true, requires2fa: true, tempToken });
  }

  await logLogin(user.id, 'admin', ip, ua, 'success');
  return res.json({ success: true, token: signAdminToken(user), user: publicUser(user) });
}

// ── Confirm TOTP after login ──────────────────────────────────────────────────
async function confirmTotp(req, res) {
  const { tempToken, totp } = req.body;
  if (!tempToken || !totp) {
    return res.status(400).json({ success: false, message: 'Temp token and TOTP code required' });
  }

  let payload;
  try {
    payload = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(403).json({ success: false, message: 'Temp token invalid or expired' });
  }

  if (payload.type !== 'admin_temp') {
    return res.status(403).json({ success: false, message: 'Invalid token type' });
  }

  const [[row]] = await db.query('SELECT secret FROM admin_2fa WHERE user_id = ? AND is_enabled = 1', [payload.id]);
  if (!row) return res.status(403).json({ success: false, message: '2FA not configured' });

  const secret = decryptSecret(row.secret);
  const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(totp), window: 1 });

  if (!verified) {
    return res.status(401).json({ success: false, message: 'Invalid TOTP code' });
  }

  const [[user]] = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [payload.id]);
  return res.json({ success: true, token: signAdminToken(user), user: publicUser(user) });
}

// ── 2FA setup ─────────────────────────────────────────────────────────────────
async function setup2FA(req, res) {
  const userId = req.user.id;
  const [[user]] = await db.query('SELECT name, email FROM users WHERE id = ?', [userId]);

  const secretObj = speakeasy.generateSecret({
    name: `${process.env.TOTP_APP_NAME || 'KUPPET Migori'} (${user.email})`,
    length: 20,
  });

  const encryptedSecret = encryptSecret(secretObj.base32);
  const backupCodes = generateBackupCodes();

  await db.query(
    `INSERT INTO admin_2fa (user_id, secret, is_enabled, backup_codes)
     VALUES (?, ?, FALSE, ?)
     ON DUPLICATE KEY UPDATE secret = VALUES(secret), is_enabled = FALSE, backup_codes = VALUES(backup_codes)`,
    [userId, encryptedSecret, JSON.stringify(backupCodes)]
  );

  const qrUrl = await QRCode.toDataURL(secretObj.otpauth_url);
  return res.json({ success: true, qrCode: qrUrl, manualKey: secretObj.base32, backupCodes });
}

// ── 2FA enable (verify first code after setup) ────────────────────────────────
async function enable2FA(req, res) {
  const { totp } = req.body;
  if (!totp) return res.status(400).json({ success: false, message: 'TOTP code required' });

  const [[row]] = await db.query('SELECT secret FROM admin_2fa WHERE user_id = ?', [req.user.id]);
  if (!row) return res.status(400).json({ success: false, message: '2FA not set up yet' });

  const secret = decryptSecret(row.secret);
  const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(totp), window: 1 });

  if (!verified) return res.status(401).json({ success: false, message: 'Invalid TOTP code' });

  await db.query('UPDATE admin_2fa SET is_enabled = TRUE WHERE user_id = ?', [req.user.id]);
  return res.json({ success: true, message: '2FA enabled successfully' });
}

// ── 2FA disable ───────────────────────────────────────────────────────────────
async function disable2FA(req, res) {
  await db.query('DELETE FROM admin_2fa WHERE user_id = ?', [req.user.id]);
  return res.json({ success: true, message: '2FA disabled' });
}

// ── Change password ───────────────────────────────────────────────────────────
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Old and new passwords required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const [[user]] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
  return res.json({ success: true, message: 'Password updated successfully' });
}

// ── Get current user ──────────────────────────────────────────────────────────
async function getMe(req, res) {
  const [[user]] = await db.query(
    'SELECT id, name, email, role, is_active, last_login, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const [[twofa]] = await db.query('SELECT is_enabled FROM admin_2fa WHERE user_id = ?', [req.user.id]);
  return res.json({ success: true, data: { ...user, twofa_enabled: !!(twofa && twofa.is_enabled) } });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function logLogin(userId, userType, ip, ua, status) {
  try {
    await db.query(
      'INSERT INTO login_history (user_id, user_type, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?)',
      [userId, userType, ip, ua, status]
    );
  } catch (_) {}
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

module.exports = { adminLogin, confirmTotp, setup2FA, enable2FA, disable2FA, changePassword, getMe };
