const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeRoles, auditLog } = require('../middleware/auth');

// Court cases are restricted to branch officers (super_admin retains full access);
// branch_secretary is excluded.
const authorizeCourt = authorizeRoles('branch_officer');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
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

// All routes are restricted to branch officers + super_admin (see authorizeCourt).
router.get('/', authenticate, authorizeCourt, ctrl.getAll);
router.get('/stats', authenticate, authorizeCourt, ctrl.getStats);
router.get('/:id', authenticate, authorizeCourt, idParam, handleValidation, ctrl.getOne);
router.post('/', authenticate, authorizeCourt, caseRules, handleValidation, auditLog('court_case.create'), ctrl.create);
router.put('/:id', authenticate, authorizeCourt, idParam, caseRules, handleValidation, auditLog('court_case.update'), ctrl.update);
router.delete('/:id', authenticate, authorizeCourt, idParam, handleValidation, auditLog('court_case.delete'), ctrl.remove);
router.post('/:id/updates', authenticate, authorizeCourt, idParam, updateNoteRules, handleValidation, auditLog('court_case.update_added'), ctrl.addUpdate);

// Document attachments (validators run after multer so req.body.label is populated)
router.post('/:id/documents', authenticate, authorizeCourt, upload.courtDocs.array('files', 10),
  idParam, body('label').optional({ nullable: true }).trim().isLength({ max: 200 }), handleValidation,
  auditLog('court_case.doc_upload'), ctrl.uploadDocuments);
router.delete('/:id/documents/:docId', authenticate, authorizeCourt,
  idParam, param('docId').isInt({ min: 1 }).withMessage('Invalid doc id'), handleValidation,
  auditLog('court_case.doc_delete'), ctrl.removeDocument);

module.exports = router;
