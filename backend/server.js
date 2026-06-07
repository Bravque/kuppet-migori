const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'maps.googleapis.com'],
      imgSrc: ["'self'", 'data:', '*.googleapis.com', '*.gstatic.com', 'images.unsplash.com'],
      frameSrc: ["'self'", '*.google.com'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: process.env.FRONTEND_URL || `http://localhost:${PORT}` }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many contact submissions. Please try again in an hour.' }
});

app.use('/api/', apiLimiter);
app.use('/api/contact', contactLimiter);

// Static files
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// API routes
app.use('/api/news', require('./routes/news'));
app.use('/api/events', require('./routes/events'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/leadership', require('./routes/leadership'));
app.use('/api/scholarships', require('./routes/scholarships'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/advocacy', require('./routes/advocacy'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'KUPPET Migori API', timestamp: new Date().toISOString() });
});

// SPA fallback - serve HTML pages
app.get('*', (req, res) => {
  const requestedFile = req.path === '/' ? 'index.html' : req.path;
  const filePath = path.join(__dirname, '../public', requestedFile);
  res.sendFile(filePath, err => {
    if (err) res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🏫 KUPPET Migori Web Application`);
  console.log(`✓  Server running at http://localhost:${PORT}`);
  console.log(`✓  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
