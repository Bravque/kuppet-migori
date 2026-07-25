const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/emailController');

const sendRules = [
  body('email').trim().notEmpty().withMessage('Email required').isEmail().withMessage('Valid email required').isLength({ max: 254 }),
  body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 5000 }),
];
const bulkRules = [
  body('recipients').isArray({ min: 1 }).withMessage('recipients must be a non-empty array'),
  body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 5000 }),
];
const groupRules = [
  body('group').isIn(['all_approved', 'sub_county']).withMessage('Invalid group'),
  body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 5000 }),
  body('sub_county').if(body('group').equals('sub_county')).trim().notEmpty().withMessage('sub_county required for a sub-county send').isLength({ max: 150 }),
];
const TEMPLATE_CATEGORIES = ['bbf', 'scholarship', 'general', 'system'];
// Create requires name + subject + body; update lets any subset through (partial edit).
const templateCreateRules = [
  body('name').trim().notEmpty().withMessage('Name required').isLength({ max: 150 }),
  body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 200 }),
  body('body').trim().notEmpty().withMessage('Body required').isLength({ max: 5000 }),
  body('category').optional().isIn(TEMPLATE_CATEGORIES).withMessage('Invalid template category'),
];
const templateUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 150 }),
  body('subject').optional().trim().notEmpty().withMessage('Subject cannot be empty').isLength({ max: 200 }),
  body('body').optional().trim().notEmpty().withMessage('Body cannot be empty').isLength({ max: 5000 }),
  body('category').optional().isIn(TEMPLATE_CATEGORIES).withMessage('Invalid template category'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
];

// All communication features are open to every admin role via authorizeAdmin.
router.post('/send',  authenticate, authorizeAdmin, sendRules,  handleValidation, auditLog('email.send'),  ctrl.send);
router.post('/bulk',  authenticate, authorizeAdmin, bulkRules,  handleValidation, auditLog('email.bulk'),  ctrl.bulk);
router.post('/group', authenticate, authorizeAdmin, groupRules, handleValidation, auditLog('email.group'), ctrl.sendToGroup);
router.get('/logs',   authenticate, authorizeAdmin, ctrl.getLogs);
router.get('/templates',      authenticate, authorizeAdmin, ctrl.getTemplates);
router.post('/templates',     authenticate, authorizeAdmin, templateCreateRules, handleValidation, ctrl.createTemplate);
router.put('/templates/:id',  authenticate, authorizeAdmin, templateUpdateRules, handleValidation, ctrl.updateTemplate);

// Automated / transactional email templates (editable subject + body overrides).
const transactionalRules = [
  body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 255 }),
  body('body').trim().notEmpty().withMessage('Body required').isLength({ max: 20000 }),
];
router.get('/transactional',         authenticate, authorizeAdmin, ctrl.getTransactionalTemplates);
router.put('/transactional/:key',    authenticate, authorizeAdmin, transactionalRules, handleValidation, auditLog('email.transactional_update'), ctrl.updateTransactionalTemplate);
router.delete('/transactional/:key', authenticate, authorizeAdmin, auditLog('email.transactional_reset'), ctrl.resetTransactionalTemplate);

module.exports = router;
