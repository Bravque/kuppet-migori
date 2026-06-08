const router = require('express').Router();
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const ctrl = require('../controllers/adminMembersController');

router.get('/export', authenticate, authorizeSuperAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, ctrl.getOne);
router.put('/:id/approve', authenticate, authorizeAdmin, auditLog('member.approve'), ctrl.approve);
router.put('/:id/reject', authenticate, authorizeAdmin, auditLog('member.reject'), ctrl.reject);
router.put('/:id/suspend', authenticate, authorizeSuperAdmin, auditLog('member.suspend'), ctrl.suspend);
router.delete('/:id', authenticate, authorizeSuperAdmin, auditLog('member.delete'), ctrl.remove);

module.exports = router;
