const crypto = require('crypto');

const COOKIE_NAME = '__csrf';
const HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Issue a CSRF token cookie on first visit; validate it on state-changing requests.
// Uses the double-submit cookie pattern — no server-side session required.
const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  const headerToken = req.headers[HEADER_NAME];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }
  next();
};

// Middleware to issue the CSRF cookie on portal page loads (call on GET routes)
const issueCsrfCookie = (req, res, next) => {
  if (!req.cookies || !req.cookies[COOKIE_NAME]) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(COOKIE_NAME, token, {
      httpOnly: false, // JS must be able to read it to send in header
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  next();
};

module.exports = { csrfProtection, issueCsrfCookie };
