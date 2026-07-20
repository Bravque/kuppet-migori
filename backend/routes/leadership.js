const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, adminCreate, adminUpdate, adminRemove } = require('../controllers/leadershipController');
const { authenticate, authorizeContent, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');

const POSITION_CATEGORIES = ['executive', 'committee', 'trustee'];
// Runs after multer (photo upload), so req.body is populated.
const leadershipRules = [
  body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Name must be 1–200 characters'),
  body('position').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Position must be 1–200 characters'),
  body('position_category').optional().isIn(POSITION_CATEGORIES).withMessage('Invalid position category'),
  body('bio').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('email').optional({ nullable: true, checkFalsy: true }).trim().isEmail().withMessage('Invalid email').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
  body('display_order').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 9999 }).withMessage('display_order must be a number'),
];

router.get('/', getAll);

router.post('/', authenticate, authorizeContent, upload.photo.single('photo'), leadershipRules, handleValidation, auditLog('leadership.create'), adminCreate);
router.put('/:id', authenticate, authorizeContent, upload.photo.single('photo'), leadershipRules, handleValidation, auditLog('leadership.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeContent, auditLog('leadership.delete'), adminRemove);

module.exports = router;
