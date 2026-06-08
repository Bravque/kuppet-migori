const router = require('express').Router();
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const ctrl = require('../controllers/adminSchAppController');

router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, ctrl.getOne);
router.put('/:id/approve', authenticate, authorizeSuperAdmin, auditLog('schapp.approve'), ctrl.approve);
router.put('/:id/reject', authenticate, authorizeAdmin, auditLog('schapp.reject'), ctrl.reject);

module.exports = router;
