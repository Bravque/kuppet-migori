const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeRoles, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminMembersController');

// Member decisions (approve/reject/suspend/delete) are branch_officer + super_admin;
// branch_secretary can view/print but not decide. Exports stay super_admin-only.
const authorizeDecision = authorizeRoles('branch_officer');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const reason = body('reason').optional({ nullable: true }).trim().isLength({ max: 2000 });

// Excel export is available to all admin roles.
router.get('/export', authenticate, authorizeAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/approve', authenticate, authorizeDecision, idParam, handleValidation, auditLog('member.approve'), ctrl.approve);
router.put('/:id/reject', authenticate, authorizeDecision, idParam, reason, handleValidation, auditLog('member.reject'), ctrl.reject);
router.put('/:id/suspend', authenticate, authorizeDecision, idParam, reason, handleValidation, auditLog('member.suspend'), ctrl.suspend);
router.delete('/:id', authenticate, authorizeDecision, idParam, handleValidation, auditLog('member.delete'), ctrl.remove);

module.exports = router;
