const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/smsController');

const TEMPLATE_CATEGORIES = ['bbf', 'scholarship', 'general', 'system'];
const sendRules = [
  body('phone').trim().notEmpty().withMessage('Phone required').isLength({ max: 30 }),
  body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 1600 }).withMessage('Message too long (max 1600)'),
];
const bulkRules = [
  body('recipients').isArray({ min: 1 }).withMessage('recipients must be a non-empty array'),
  body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 1600 }),
];
const groupRules = [
  body('group').isIn(['all_approved', 'sub_county']).withMessage('Invalid group'),
  body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 1600 }),
  body('sub_county').if(body('group').equals('sub_county')).trim().notEmpty().withMessage('sub_county required for a sub-county send').isLength({ max: 150 }),
];
const templateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 150 }),
  body('body').optional().trim().notEmpty().withMessage('Body cannot be empty').isLength({ max: 1600 }),
  body('category').optional().isIn(TEMPLATE_CATEGORIES).withMessage('Invalid template category'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
];

router.post('/send', authenticate, authorizeAdmin, sendRules, handleValidation, auditLog('sms.send'), ctrl.send);
router.post('/bulk', authenticate, authorizeSuperAdmin, bulkRules, handleValidation, auditLog('sms.bulk'), ctrl.bulk);
router.post('/group', authenticate, authorizeSuperAdmin, groupRules, handleValidation, auditLog('sms.group'), ctrl.sendToGroup);
router.get('/logs', authenticate, authorizeAdmin, ctrl.getLogs);
router.get('/templates', authenticate, authorizeAdmin, ctrl.getTemplates);
router.post('/templates', authenticate, authorizeSuperAdmin, templateRules, handleValidation, ctrl.createTemplate);
router.put('/templates/:id', authenticate, authorizeSuperAdmin, templateRules, handleValidation, ctrl.updateTemplate);

module.exports = router;
