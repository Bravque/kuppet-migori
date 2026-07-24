const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/notificationTemplateController');

const rules = [
  body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 255 }),
  body('body').trim().notEmpty().withMessage('Message required').isLength({ max: 5000 }),
];

// Application-notification templates (BBF + scholarship status). All admin roles.
router.get('/',        authenticate, authorizeAdmin, ctrl.list);
router.put('/:key',    authenticate, authorizeAdmin, rules, handleValidation, auditLog('notification_template.update'), ctrl.update);
router.delete('/:key', authenticate, authorizeAdmin, auditLog('notification_template.reset'), ctrl.reset);

module.exports = router;
