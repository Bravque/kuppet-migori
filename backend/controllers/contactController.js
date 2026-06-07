const db = require('../config/database');
const { validationResult } = require('express-validator');

const submit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, subject, message, category } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    await db.query(
      'INSERT INTO contacts (name, email, phone, subject, message, category, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, subject || null, message, category || 'general', ip]
    );

    res.json({ success: true, message: 'Your message has been received. We will respond within 2 business days.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit message. Please try again or call our office directly.' });
  }
};

module.exports = { submit };
