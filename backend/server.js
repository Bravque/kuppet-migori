const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { csrfProtection, issueCsrfCookie } = require('./middleware/csrf');

// Guard: member and admin JWT secrets must differ
if (process.env.JWT_SECRET && process.env.JWT_MEMBER_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_MEMBER_SECRET) {
  throw new Error('JWT_SECRET and JWT_MEMBER_SECRET must be different values');
}

// Bootstrap upload directories at startup
const UPLOAD_DIRS = ['photos', 'documents', 'bbf', 'scholarships', 'members'];
const UPLOAD_ROOT = path.join(__dirname, '../public/uploads');
for (const dir of UPLOAD_DIRS) {
  fs.mkdirSync(path.join(UPLOAD_ROOT, dir), { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

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
}));

app.use(cors({ origin: process.env.FRONTEND_URL || `http://localhost:${PORT}` }));
app.use(morgan('dev'));
app.use(cookieParser());
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

app.use('/api/', apiLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/member/auth/login', authLimiter);
app.use('/api/member/auth/register', regLimiter);

// Static files (public/uploads served here but sensitive member docs blocked — see /api/member/documents)
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
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
app.use('/api/settings',    require('./routes/settings'));

// ============================================
// AUTH ROUTES
// ============================================
app.use('/api/auth',        require('./routes/auth'));

// CSRF cookie for portal pages
app.use('/member', issueCsrfCookie);
app.use('/admin', issueCsrfCookie);

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
app.use('/api/admin/members',          require('./routes/adminMembers'));
app.use('/api/admin/bbf',              require('./routes/adminBbf'));
app.use('/api/admin/scholarship-apps', require('./routes/adminScholarshipApps'));
app.use('/api/admin/users',            require('./routes/adminUsers'));
app.use('/api/admin/sms',              (req, res, next) => {
  if (req.method === 'POST' && req.path === '/send') return smsLimiter(req, res, next);
  if (req.method === 'POST' && req.path === '/bulk') return smsBulkLimiter(req, res, next);
  next();
}, require('./routes/adminSms'));
app.use('/api/admin/analytics',        require('./routes/adminAnalytics'));
app.use('/api/admin/audit',            require('./routes/adminAudit'));
app.use('/api/sms/webhook',            require('./routes/smsWebhook'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'KUPPET Migori API', timestamp: new Date().toISOString() });
});

// Portal page handlers — must be above the wildcard to prevent index.html fallback
app.get('/member/*', (req, res, next) => {
  const file = path.join(__dirname, '../public', req.path);
  res.sendFile(file.endsWith('.html') ? file : file + '.html', err => {
    if (err) res.sendFile(path.join(__dirname, '../public/member/login.html'));
  });
});

app.get('/admin/*', (req, res, next) => {
  const file = path.join(__dirname, '../public', req.path);
  res.sendFile(file.endsWith('.html') ? file : file + '.html', err => {
    if (err) res.sendFile(path.join(__dirname, '../public/admin/login.html'));
  });
});

// SPA fallback for public pages
app.get('*', (req, res) => {
  const requestedFile = req.path === '/' ? 'index.html' : req.path;
  const filePath = path.join(__dirname, '../public', requestedFile);
  res.sendFile(filePath, err => {
    if (err) res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });
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
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\nKUPPET Migori Web Application`);
  console.log(`  Server:      http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Admin:       http://localhost:${PORT}/admin/login.html`);
  console.log(`  Member:      http://localhost:${PORT}/member/login.html\n`);
});

module.exports = app;
