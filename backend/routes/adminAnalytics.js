const router = require('express').Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/summary', authenticate, authorizeAdmin, ctrl.getSummary);
router.get('/monthly', authenticate, authorizeAdmin, ctrl.getMonthlyTrends);
// Dashboard "Export Report" PDF — available to all admin roles.
router.get('/export-pdf', authenticate, authorizeAdmin, ctrl.exportPdf);

module.exports = router;
