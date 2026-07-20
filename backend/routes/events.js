const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, getUpcoming, adminCreate, adminUpdate, adminRemove } = require('../controllers/eventsController');
const { authenticate, authorizeContent, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const EVENT_TYPES = ['meeting', 'workshop', 'seminar', 'agm', 'strike', 'other'];
const eventRules = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be 1–300 characters'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 20000 }),
  body('event_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('event_date must be a valid date'),
  body('end_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('end_date must be a valid date'),
  body('event_type').optional().isIn(EVENT_TYPES).withMessage('Invalid event type'),
  body('venue').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('venue_address').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('registration_link').optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage('Registration link must be a URL'),
];

router.get('/', getAll);
router.get('/upcoming', getUpcoming);

router.post('/', authenticate, authorizeContent, eventRules, handleValidation, auditLog('events.create'), adminCreate);
router.put('/:id', authenticate, authorizeContent, eventRules, handleValidation, auditLog('events.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeContent, auditLog('events.delete'), adminRemove);

module.exports = router;
