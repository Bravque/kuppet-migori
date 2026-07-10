const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeRoles, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminBbfController');

// Claim decisions (approve/reject/mark-paid) are branch_officer + super_admin.
// Start-review and view stay open to all admins (branch_secretary reviews/prints).
// Exports stay super_admin-only.
const authorizeDecision = authorizeRoles('branch_officer');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const notes = body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 });
const amount = body('amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('amount must be a non-negative number');

router.get('/export', authenticate, authorizeSuperAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/review', authenticate, authorizeAdmin, idParam, notes, handleValidation, auditLog('bbf.review'), ctrl.startReview);
router.put('/:id/approve', authenticate, authorizeDecision, idParam, amount, notes, handleValidation, auditLog('bbf.approve'), ctrl.approveClaim);
router.put('/:id/reject', authenticate, authorizeDecision, idParam, notes, handleValidation, auditLog('bbf.reject'), ctrl.rejectClaim);
router.put('/:id/paid', authenticate, authorizeDecision, idParam, body('ref').optional({ nullable: true }).trim().isLength({ max: 200 }), handleValidation, auditLog('bbf.paid'), ctrl.markPaid);

module.exports = router;
