const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeRoles, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminSchAppController');

// Scholarship-application decisions (approve/reject) are branch_officer + super_admin;
// branch_secretary can view/print but not decide.
const authorizeDecision = authorizeRoles('branch_officer');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const notes = body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 });
const amount = body('amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Amount must be a positive number');

router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/approve', authenticate, authorizeDecision, idParam, notes, amount, handleValidation, auditLog('schapp.approve'), ctrl.approve);
router.put('/:id/reject', authenticate, authorizeDecision, idParam, notes, handleValidation, auditLog('schapp.reject'), ctrl.reject);

module.exports = router;
