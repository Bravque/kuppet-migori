const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminMembersController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const reason = body('reason').optional({ nullable: true }).trim().isLength({ max: 2000 });

router.get('/export', authenticate, authorizeSuperAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/approve', authenticate, authorizeAdmin, idParam, handleValidation, auditLog('member.approve'), ctrl.approve);
router.put('/:id/reject', authenticate, authorizeAdmin, idParam, reason, handleValidation, auditLog('member.reject'), ctrl.reject);
router.put('/:id/suspend', authenticate, authorizeSuperAdmin, idParam, reason, handleValidation, auditLog('member.suspend'), ctrl.suspend);
router.delete('/:id', authenticate, authorizeSuperAdmin, idParam, handleValidation, auditLog('member.delete'), ctrl.remove);

module.exports = router;
