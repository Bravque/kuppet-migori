const router = require('express').Router();
const { authenticate, authorizeAdmin, authorizeSuperAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/summary', authenticate, authorizeAdmin, ctrl.getSummary);
router.get('/monthly', authenticate, authorizeAdmin, ctrl.getMonthlyTrends);
router.get('/export-pdf', authenticate, authorizeSuperAdmin, ctrl.exportPdf);

module.exports = router;
