const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeRoles, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/adminBbfController');

// Claim decisions (approve/reject/mark-paid) are branch_officer + super_admin.
// Start-review and view stay open to all admins (branch_secretary reviews/prints).
// Exports are available to all admin roles.
const authorizeDecision = authorizeRoles('branch_officer');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const notes = body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 });
const amount = body('amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('amount must be a non-negative number');

// Admin files a death-of-member claim. Multipart (the death documents ride along),
// so upload.fields runs before the validators populate req.body. The controller
// enforces the not-in-future date and the required-documents set.
const createClaimDocs = upload.bbfDocs.fields([
  { name: 'tsc_slip', maxCount: 1 },
  { name: 'burial_permit', maxCount: 1 },
  { name: 'bbf_claim_form', maxCount: 1 },
  { name: 'birth_notification', maxCount: 1 },
]);
const createClaimRules = [
  body('member_id').isInt({ min: 1 }).withMessage('Select a member'),
  body('date_of_death').notEmpty().withMessage('Date of death is required').isISO8601().withMessage('Date of death must be a valid date'),
  body('next_of_kin_name').trim().notEmpty().withMessage('Next of kin name is required').isLength({ max: 200 }),
  body('next_of_kin_phone').trim().notEmpty().withMessage('Next of kin phone is required').isLength({ max: 30 }),
  body('next_of_kin_relationship').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
  body('next_of_kin_email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Next of kin email is invalid').isLength({ max: 255 }),
  body('amount_requested').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
];

router.get('/export', authenticate, authorizeAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.post('/', authenticate, authorizeAdmin, createClaimDocs, createClaimRules, handleValidation, auditLog('bbf.create'), ctrl.createForMember);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/review', authenticate, authorizeAdmin, idParam, notes, handleValidation, auditLog('bbf.review'), ctrl.startReview);
router.put('/:id/approve', authenticate, authorizeDecision, idParam, amount, notes, handleValidation, auditLog('bbf.approve'), ctrl.approveClaim);
router.put('/:id/reject', authenticate, authorizeDecision, idParam, notes, handleValidation, auditLog('bbf.reject'), ctrl.rejectClaim);
router.put('/:id/paid', authenticate, authorizeDecision, idParam, body('ref').optional({ nullable: true }).trim().isLength({ max: 200 }), handleValidation, auditLog('bbf.paid'), ctrl.markPaid);

module.exports = router;
