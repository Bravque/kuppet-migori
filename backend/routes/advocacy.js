const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, getOne, adminCreate, adminUpdate, adminRemove } = require('../controllers/advocacyController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const ADVOCACY_CATEGORIES = ['rights', 'legal', 'labour', 'policy', 'news', 'report'];
const advocacyRules = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be 1–300 characters'),
  body('content').optional().trim().isLength({ min: 1, max: 50000 }).withMessage('Content must be 1–50000 characters'),
  body('category').optional().isIn(ADVOCACY_CATEGORIES).withMessage('Invalid category'),
];

router.get('/', getAll);
router.get('/:slug', getOne);

router.post('/', authenticate, authorizeAdmin, advocacyRules, handleValidation, auditLog('advocacy.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, advocacyRules, handleValidation, auditLog('advocacy.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('advocacy.delete'), adminRemove);

module.exports = router;
