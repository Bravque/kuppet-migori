const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
require('express-async-errors'); // forwards rejected async-handler promises to the error handler
const db = require('./config/database');
const { sendErrorAlert } = require('./services/alertService');
const { csrfProtection, issueCsrfCookie } = require('./middleware/csrf');

const isProd = process.env.NODE_ENV === 'production';

// Guard: member and admin JWT secrets must differ
if (process.env.JWT_SECRET && process.env.JWT_MEMBER_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_MEMBER_SECRET) {
  throw new Error('JWT_SECRET and JWT_MEMBER_SECRET must be different values');
}

// Guard: TOTP secrets are encrypted at rest — refuse to boot with a missing/weak key
{
  const k = process.env.TOTP_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(k) || /^0+$/.test(k)) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 random hex characters (32 bytes). Generate with: openssl rand -hex 32');
  }
}

// Guard: in production the CORS origin must be set explicitly (no localhost fallback)
if (isProd && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be set in production (CORS origin)');
}

// Bootstrap upload directories at startup. UPLOAD_ROOT may live outside the
// deployed tree (set UPLOAD_DIR) so uploads survive git-based redeploys.
const { UPLOAD_ROOT, UPLOAD_SUBDIRS } = require('./config/paths');
for (const dir of UPLOAD_SUBDIRS) {
  fs.mkdirSync(path.join(UPLOAD_ROOT, dir), { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy hop (Hostinger nginx/Passenger) so rate-limiting uses the real client IP
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'maps.googleapis.com', 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', '*.googleapis.com', '*.gstatic.com', 'images.unsplash.com'],
      frameSrc: ["'self'", '*.google.com'],
      connectSrc: ["'self'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // 2 years
}));

// Permissions-Policy (Helmet does not set this) — deny powerful features by default
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  next();
});

app.use(cors({ origin: process.env.FRONTEND_URL || `http://localhost:${PORT}` }));
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(cookieParser());
// Issue the CSRF token cookie early (before static file serving) so portal HTML
// pages — which are served as static files — always carry it. The SPA JS reads
// this cookie and echoes it as X-CSRF-Token on state-changing requests, which
// csrfProtection validates on /api/member and /api/admin.
app.use(issueCsrfCookie);
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many contact submissions. Please try again in an hour.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

const regLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many registration attempts. Please try again in an hour.' },
});

const forgotPwLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset requests. Please try again in an hour.' },
});

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'SMS rate limit exceeded.' },
});

const smsBulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Bulk SMS limit reached. Try again in an hour.' },
});

const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Email rate limit exceeded.' },
});

const emailBulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Bulk email limit reached. Try again in an hour.' },
});

app.use('/api/', apiLimiter);
// Only rate-limit public contact-form submissions (POST /api/contact). The admin
// Contact Inbox reads/replies (GET, PUT, POST /:id/reply) must NOT count against
// the 5/hr limit, or loading the inbox a few times locks admins out.
app.use('/api/contact', (req, res, next) => {
  if (req.method === 'POST' && (req.path === '/' || req.path === '')) return contactLimiter(req, res, next);
  next();
});
app.use('/api/auth', authLimiter);
app.use('/api/member/auth/login', authLimiter);
app.use('/api/member/auth/register', regLimiter);
app.use('/api/member/auth/forgot-password', forgotPwLimiter);

// Block direct static access to sensitive document directories — these contain
// member PII (National IDs, passport photos), claim/scholarship attachments, and
// court-case documents (legal filings). They are served ONLY through
// ownership/role-checked endpoints:
//   members:   GET /api/member/documents/:filename   (owning member)
//   admin:     GET /api/admin/documents/:filename     (authenticated admin)
app.use(['/uploads/members', '/uploads/bbf', '/uploads/scholarships', '/uploads/court', '/uploads/disciplinary'], (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Serve uploaded files from the (possibly external) persistent UPLOAD_ROOT.
// photos/ documents/ news/ are public; members/ bbf/ scholarships/ were 404'd above.
// A missing file returns a real 404 (not the SPA index.html), so broken <img>s
// fail fast and can show their onerror fallback instead of rendering HTML.
app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: isProd ? '1d' : 0 }));
app.use('/uploads', (req, res) => res.status(404).json({ success: false, message: 'File not found' }));

// Static files (CSS/JS/images). Sensitive upload dirs blocked above; /uploads served above.
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: isProd ? '1d' : 0,
  setHeaders: (res, filePath) => {
    // HTML must always revalidate (304 when unchanged via ETag) so a deploy —
    // and the bumped `?v=` asset refs it contains — is visible immediately
    // instead of being cached for a day. Versioned CSS/JS/images keep the long
    // max-age above. Without this, browsers held the homepage (incl. the ticker
    // markup) for 24h and never re-fetched to pick up admin changes.
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ============================================
// PUBLIC API ROUTES
// ============================================
app.use('/api/news',        require('./routes/news'));
app.use('/api/events',      require('./routes/events'));
app.use('/api/resources',   require('./routes/resources'));
app.use('/api/leadership',  require('./routes/leadership'));
app.use('/api/scholarships',require('./routes/scholarships'));
app.use('/api/contact',     require('./routes/contact'));
app.use('/api/advocacy',    require('./routes/advocacy'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/settings',    require('./routes/settings'));

// ============================================
// AUTH ROUTES
// ============================================
app.use('/api/auth',        require('./routes/auth'));

// CSRF enforcement (double-submit cookie) on all state-changing portal API
// requests. Skips safe methods internally; the cookie is issued globally above
// (issueCsrfCookie) and the front-end echoes it as the X-CSRF-Token header.
app.use('/api/member', csrfProtection);
app.use('/api/admin',  csrfProtection);

// ============================================
// MEMBER PORTAL ROUTES
// ============================================
app.use('/api/member/auth',          require('./routes/memberAuth'));
app.use('/api/member/profile',       require('./routes/memberProfile'));
app.use('/api/member/bbf',           require('./routes/memberBbf'));
app.use('/api/member/scholarships',  require('./routes/memberScholarships'));
app.use('/api/member/notifications', require('./routes/memberNotifications'));
app.use('/api/member/documents',     require('./routes/memberDocuments'));

// ============================================
// ADMIN ROUTES
// ============================================
app.use('/api/admin/documents',        require('./routes/adminDocuments'));
app.use('/api/admin/members',          require('./routes/adminMembers'));
app.use('/api/admin/bbf',              require('./routes/adminBbf'));
app.use('/api/admin/scholarship-apps', require('./routes/adminScholarshipApps'));
app.use('/api/admin/users',            require('./routes/adminUsers'));
app.use('/api/admin/sms',              (req, res, next) => {
  if (req.method === 'POST' && req.path === '/send') return smsLimiter(req, res, next);
  if (req.method === 'POST' && req.path === '/bulk') return smsBulkLimiter(req, res, next);
  next();
}, require('./routes/adminSms'));
app.use('/api/admin/email',            (req, res, next) => {
  if (req.method === 'POST' && req.path === '/send') return emailLimiter(req, res, next);
  if (req.method === 'POST' && (req.path === '/bulk' || req.path === '/group')) return emailBulkLimiter(req, res, next);
  next();
}, require('./routes/adminEmail'));
app.use('/api/admin/analytics',        require('./routes/adminAnalytics'));
app.use('/api/admin/audit',            require('./routes/adminAudit'));
app.use('/api/admin/court-cases',      require('./routes/courtCases'));
app.use('/api/admin/disciplinary-cases', require('./routes/disciplinaryCases'));
app.use('/api/sms/webhook',            require('./routes/smsWebhook'));

// Health check — pings the DB so uptime monitors detect a DB outage (503, not a false 200).
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, service: 'KUPPET Migori API', db: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ success: false, service: 'KUPPET Migori API', db: 'down', timestamp: new Date().toISOString() });
  }
});

const PUBLIC_ROOT = path.join(__dirname, '../public');

// Resolve a request path safely inside PUBLIC_ROOT; returns null on traversal attempts.
function safePublicPath(reqPath) {
  const rel = reqPath.replace(/^\/+/, '');
  const resolved = path.join(PUBLIC_ROOT, rel);
  return resolved === PUBLIC_ROOT || resolved.startsWith(PUBLIC_ROOT + path.sep) ? resolved : null;
}

// Unknown API routes must return JSON 404 — otherwise they fall through to the SPA
// fallback below and return index.html (HTML), which breaks JSON clients.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Portal page handlers — must be above the wildcard to prevent index.html fallback
// Serve a static HTML file, falling back to a shell page; if even the shell
// can't be served (e.g. a transient during a redeploy), return a plain 404
// rather than throwing into the global handler — which would 500 and fire an
// alert email. `sendFile` errors before streaming leave headers unsent.
function sendPage(res, file, shell) {
  res.sendFile(file, err => {
    if (!err) return;
    res.sendFile(path.join(PUBLIC_ROOT, shell), err2 => {
      if (err2 && !res.headersSent) res.status(404).type('txt').send('Not found');
    });
  });
}

app.get('/member/*', (req, res) => {
  const file = safePublicPath(req.path);
  if (!file) return res.status(400).end();
  sendPage(res, file.endsWith('.html') ? file : file + '.html', 'member/login.html');
});

app.get('/admin/*', (req, res) => {
  const file = safePublicPath(req.path);
  if (!file) return res.status(400).end();
  sendPage(res, file.endsWith('.html') ? file : file + '.html', 'admin/login.html');
});

// Dynamic sitemap — static public pages + every published news & advocacy article,
// so new content gets discovered and indexed automatically. Referenced by robots.txt.
const SITE_URL = (process.env.APP_URL || 'https://kuppetmigori.co.ke').replace(/\/$/, '');
app.get('/sitemap.xml', async (req, res) => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/pages/about.html', priority: '0.8', changefreq: 'monthly' },
    { loc: '/pages/news.html', priority: '0.9', changefreq: 'daily' },
    { loc: '/pages/resources.html', priority: '0.8', changefreq: 'weekly' },
    { loc: '/pages/advocacy.html', priority: '0.8', changefreq: 'weekly' },
    { loc: '/pages/scholarships.html', priority: '0.7', changefreq: 'weekly' },
    { loc: '/pages/contact.html', priority: '0.6', changefreq: 'monthly' },
  ];
  try {
    const [news] = await db.query(
      'SELECT slug, updated_at FROM news WHERE is_published = 1 ORDER BY updated_at DESC');
    for (const n of news) {
      urls.push({ loc: `/pages/article.html?slug=${encodeURIComponent(n.slug)}`, lastmod: n.updated_at, priority: '0.7', changefreq: 'weekly' });
    }
    const [adv] = await db.query(
      'SELECT slug, updated_at FROM advocacy WHERE is_published = 1 ORDER BY updated_at DESC');
    for (const a of adv) {
      urls.push({ loc: `/pages/advocacy-article.html?slug=${encodeURIComponent(a.slug)}`, lastmod: a.updated_at, priority: '0.6', changefreq: 'weekly' });
    }
  } catch (err) {
    console.error('Sitemap DB query failed, serving static pages only:', err.message);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${esc(SITE_URL + u.loc)}</loc>${u.lastmod ? `
    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  res.type('application/xml').send(body);
});

// SPA fallback for public pages
app.get('*', (req, res) => {
  const filePath = req.path === '/' ? path.join(PUBLIC_ROOT, 'index.html') : safePublicPath(req.path);
  if (!filePath) return res.status(400).end();
  sendPage(res, filePath, 'index.html');
});

// Global error handler (catches multer errors too)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large' });
  }
  if (err.message && err.message.startsWith('File type not allowed')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err.stack);
  sendErrorAlert('500 Internal Server Error', `${req.method} ${req.originalUrl}\n\n${err.stack || err}`);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Process-level backstop: log out-of-band failures (e.g. a stray rejection in a
// fire-and-forget sendMail/sendSms) instead of crashing silently. We log rather than
// force-exit to avoid a restart loop on shared hosting; request-scoped errors are
// already handled by express-async-errors + the global handler above.
process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? reason.stack : String(reason);
  console.error('UNHANDLED REJECTION:', detail);
  sendErrorAlert('Unhandled Promise Rejection', detail);
});
process.on('uncaughtException', (err) => {
  const detail = err.stack || String(err);
  console.error('UNCAUGHT EXCEPTION:', detail);
  sendErrorAlert('Uncaught Exception', detail);
});

app.listen(PORT, () => {
  console.log(`\nKUPPET Migori Web Application`);
  console.log(`  Server:      http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Admin:       http://localhost:${PORT}/admin/login.html`);
  console.log(`  Member:      http://localhost:${PORT}/member/login.html\n`);
});

module.exports = app;
