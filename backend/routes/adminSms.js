const router = require('express').Router();
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const ctrl = require('../controllers/smsController');

router.post('/send', authenticate, authorizeAdmin, auditLog('sms.send'), ctrl.send);
router.post('/bulk', authenticate, authorizeSuperAdmin, auditLog('sms.bulk'), ctrl.bulk);
router.post('/group', authenticate, authorizeSuperAdmin, auditLog('sms.group'), ctrl.sendToGroup);
router.get('/logs', authenticate, authorizeAdmin, ctrl.getLogs);
router.get('/templates', authenticate, authorizeAdmin, ctrl.getTemplates);
router.post('/templates', authenticate, authorizeSuperAdmin, ctrl.createTemplate);
router.put('/templates/:id', authenticate, authorizeSuperAdmin, ctrl.updateTemplate);

module.exports = router;
