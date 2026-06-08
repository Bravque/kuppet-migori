const router = require('express').Router();
const { authenticate, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const ctrl = require('../controllers/adminUsersController');

router.get('/', authenticate, authorizeSuperAdmin, ctrl.getAll);
router.post('/', authenticate, authorizeSuperAdmin, auditLog('admin.create'), ctrl.create);
router.put('/:id', authenticate, authorizeSuperAdmin, auditLog('admin.update'), ctrl.update);
router.delete('/:id', authenticate, authorizeSuperAdmin, auditLog('admin.delete'), ctrl.remove);

module.exports = router;
