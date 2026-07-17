const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeRoles, auditLog } = require('../middleware/auth');

// Disciplinary cases are restricted to branch officers (super_admin retains full
// access); branch_secretary is excluded — same as the Court Cases section.
const authorizeDisciplinary = authorizeRoles('branch_officer');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/disciplinaryCasesController');

const OFFENCES = ['misconduct', 'absenteeism', 'exam_irregularity', 'financial',
                  'insubordination', 'negligence', 'criminal', 'other'];
const STATUSES = ['reported', 'query_issued', 'interdicted', 'hearing', 'determined', 'appealed', 'closed'];
const OUTCOMES = ['pending', 'warning', 'suspension', 'dismissal', 'reinstated', 'cleared', 'other'];

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const caseRules = [
  body('teacher_name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Teacher name must be 1–200 characters'),
  body('case_ref').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('tsc_number').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('school').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('sub_county').optional({ nullable: true }).trim().isLength({ max: 150 }),
  body('offence_category').optional({ checkFalsy: true }).isIn(OFFENCES).withMessage('Invalid offence category'),
  body('status').optional({ checkFalsy: true }).isIn(STATUSES).withMessage('Invalid status'),
  body('outcome').optional({ checkFalsy: true }).isIn(OUTCOMES).withMessage('Invalid outcome'),
  body('reported_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('reported_date must be a date'),
  body('interdiction_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('interdiction_date must be a date'),
  body('hearing_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('hearing_date must be a date'),
  body('resolved_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('resolved_date must be a date'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 20000 }),
  body('officer_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
];
const updateNoteRules = [
  body('note').trim().isLength({ min: 1, max: 5000 }).withMessage('Note is required (max 5000 chars)'),
  body('update_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('update_date must be a date'),
];

// All routes restricted to branch officers + super_admin (see authorizeDisciplinary).
router.get('/', authenticate, authorizeDisciplinary, ctrl.getAll);
router.get('/stats', authenticate, authorizeDisciplinary, ctrl.getStats);
router.get('/:id', authenticate, authorizeDisciplinary, idParam, handleValidation, ctrl.getOne);
router.post('/', authenticate, authorizeDisciplinary, caseRules, handleValidation, auditLog('disciplinary_case.create'), ctrl.create);
router.put('/:id', authenticate, authorizeDisciplinary, idParam, caseRules, handleValidation, auditLog('disciplinary_case.update'), ctrl.update);
router.delete('/:id', authenticate, authorizeDisciplinary, idParam, handleValidation, auditLog('disciplinary_case.delete'), ctrl.remove);
router.post('/:id/updates', authenticate, authorizeDisciplinary, idParam, updateNoteRules, handleValidation, auditLog('disciplinary_case.update_added'), ctrl.addUpdate);

// Document attachments (validators run after multer so req.body.label is populated)
router.post('/:id/documents', authenticate, authorizeDisciplinary, upload.disciplinaryDocs.array('files', 10),
  idParam, body('label').optional({ nullable: true }).trim().isLength({ max: 200 }), handleValidation,
  auditLog('disciplinary_case.doc_upload'), ctrl.uploadDocuments);
router.delete('/:id/documents/:docId', authenticate, authorizeDisciplinary,
  idParam, param('docId').isInt({ min: 1 }).withMessage('Invalid doc id'), handleValidation,
  auditLog('disciplinary_case.doc_delete'), ctrl.removeDocument);

module.exports = router;
