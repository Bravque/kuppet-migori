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

// All communication features are open to every admin role via authorizeAdmin.
router.post('/send',  authenticate, authorizeAdmin, sendRules,  handleValidation, auditLog('email.send'),  ctrl.send);
router.post('/bulk',  authenticate, authorizeAdmin, bulkRules,  handleValidation, auditLog('email.bulk'),  ctrl.bulk);
router.post('/group', authenticate, authorizeAdmin, groupRules, handleValidation, auditLog('email.group'), ctrl.sendToGroup);
router.get('/logs',   authenticate, authorizeAdmin, ctrl.getLogs);

module.exports = router;
