const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getActive, adminGetAll, adminCreate, adminUpdate, adminRemove } = require('../controllers/announcementsController');
const { authenticate, authorizeContent, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const announcementRules = [
  body('text').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Text must be 1–500 characters'),
  body('link').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }),
  body('sort_order').optional({ nullable: true }).isInt({ min: 0, max: 9999 }).withMessage('Sort order must be a number').toInt(),
];

// Public — homepage ticker
router.get('/', getActive);

// Admin — full CRUD (both admin roles)
router.get('/all', authenticate, authorizeContent, adminGetAll);
router.post('/', authenticate, authorizeContent, announcementRules, handleValidation, auditLog('announcements.create'), adminCreate);
router.put('/:id', authenticate, authorizeContent, announcementRules, handleValidation, auditLog('announcements.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeContent, auditLog('announcements.delete'), adminRemove);

module.exports = router;
