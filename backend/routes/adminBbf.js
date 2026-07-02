const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminBbfController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const notes = body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 });
const amount = body('amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('amount must be a non-negative number');

router.get('/export', authenticate, authorizeSuperAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/review', authenticate, authorizeAdmin, idParam, notes, handleValidation, auditLog('bbf.review'), ctrl.startReview);
router.put('/:id/approve', authenticate, authorizeSuperAdmin, idParam, amount, notes, handleValidation, auditLog('bbf.approve'), ctrl.approveClaim);
router.put('/:id/reject', authenticate, authorizeAdmin, idParam, notes, handleValidation, auditLog('bbf.reject'), ctrl.rejectClaim);
router.put('/:id/paid', authenticate, authorizeSuperAdmin, idParam, body('ref').optional({ nullable: true }).trim().isLength({ max: 200 }), handleValidation, auditLog('bbf.paid'), ctrl.markPaid);

module.exports = router;
