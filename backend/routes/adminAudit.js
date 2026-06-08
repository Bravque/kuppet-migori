const router = require('express').Router();
const { authenticate, authorizeSuperAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/auditController');

router.get('/', authenticate, authorizeSuperAdmin, ctrl.getAll);
router.get('/export', authenticate, authorizeSuperAdmin, ctrl.exportPdf);

module.exports = router;
