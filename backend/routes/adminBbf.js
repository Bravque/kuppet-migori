const router = require('express').Router();
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const ctrl = require('../controllers/adminBbfController');

router.get('/export', authenticate, authorizeSuperAdmin, ctrl.exportExcel);
router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, ctrl.getOne);
router.put('/:id/review', authenticate, authorizeAdmin, auditLog('bbf.review'), ctrl.startReview);
router.put('/:id/approve', authenticate, authorizeSuperAdmin, auditLog('bbf.approve'), ctrl.approveClaim);
router.put('/:id/reject', authenticate, authorizeAdmin, auditLog('bbf.reject'), ctrl.rejectClaim);
router.put('/:id/paid', authenticate, authorizeSuperAdmin, auditLog('bbf.paid'), ctrl.markPaid);

module.exports = router;
