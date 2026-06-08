const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { submit, adminGetAll, adminUpdateStatus } = require('../controllers/contactController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');

router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 }),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('subject').optional().trim().isLength({ max: 300 }),
  body('category').optional().isIn(['general','membership','bbf','advocacy','resources','complaint','other']),
], submit);

// Admin
router.get('/', authenticate, authorizeAdmin, adminGetAll);
router.put('/:id/status', authenticate, authorizeAdmin, auditLog('contact.status'), adminUpdateStatus);

module.exports = router;
