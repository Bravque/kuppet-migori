const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/courtCasesController');

const CASE_TYPES = ['employment', 'disciplinary', 'criminal', 'civil', 'constitutional', 'appeal', 'other'];
const STATUSES = ['open', 'ongoing', 'on_hold', 'closed'];
const OUTCOMES = ['pending', 'won', 'lost', 'settled', 'withdrawn', 'dismissed'];

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const caseRules = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be 1–300 characters'),
  body('case_number').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('court').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('case_type').optional({ checkFalsy: true }).isIn(CASE_TYPES).withMessage('Invalid case type'),
  body('plaintiff').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('defendant').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('status').optional({ checkFalsy: true }).isIn(STATUSES).withMessage('Invalid status'),
  body('outcome').optional({ checkFalsy: true }).isIn(OUTCOMES).withMessage('Invalid outcome'),
  body('filing_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('filing_date must be a date'),
  body('next_hearing_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('next_hearing_date must be a date'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 20000 }),
  body('officer_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
];
const updateNoteRules = [
  body('note').trim().isLength({ min: 1, max: 5000 }).withMessage('Note is required (max 5000 chars)'),
  body('update_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('update_date must be a date'),
];

// All routes require an authenticated admin (super_admin or branch_officer).
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/stats', authenticate, authorizeAdmin, ctrl.getStats);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.post('/', authenticate, authorizeAdmin, caseRules, handleValidation, auditLog('court_case.create'), ctrl.create);
router.put('/:id', authenticate, authorizeAdmin, idParam, caseRules, handleValidation, auditLog('court_case.update'), ctrl.update);
router.delete('/:id', authenticate, authorizeAdmin, idParam, handleValidation, auditLog('court_case.delete'), ctrl.remove);
router.post('/:id/updates', authenticate, authorizeAdmin, idParam, updateNoteRules, handleValidation, auditLog('court_case.update_added'), ctrl.addUpdate);

module.exports = router;
