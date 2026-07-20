const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, adminCreate, adminUpdate, adminRemove } = require('../controllers/scholarshipsController');
const { authenticate, authorizeContent, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const SCHOLARSHIP_TYPES = ['kcse', 'kjsea', 'dte'];
const scholarshipRules = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be 1–300 characters'),
  body('provider').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 20000 }),
  body('eligibility').optional({ nullable: true }).trim().isLength({ max: 10000 }),
  body('benefits').optional({ nullable: true }).trim().isLength({ max: 10000 }),
  body('scholarship_type').optional().isIn(SCHOLARSHIP_TYPES).withMessage('Invalid scholarship type'),
  body('application_deadline').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Deadline must be a valid date'),
  body('application_link').optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage('Application link must be a URL'),
  body('contact_email').optional({ nullable: true, checkFalsy: true }).trim().isEmail().withMessage('Invalid contact email').normalizeEmail(),
  body('contact_phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
];

router.get('/', getAll);

router.post('/', authenticate, authorizeContent, scholarshipRules, handleValidation, auditLog('scholarships.create'), adminCreate);
router.put('/:id', authenticate, authorizeContent, scholarshipRules, handleValidation, auditLog('scholarships.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeContent, auditLog('scholarships.delete'), adminRemove);

module.exports = router;
