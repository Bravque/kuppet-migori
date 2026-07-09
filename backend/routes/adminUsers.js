const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminUsersController');

const ADMIN_ROLES = ['super_admin', 'branch_officer'];
const createRules = [
  body('name').trim().notEmpty().withMessage('Name required').isLength({ max: 200 }),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .withMessage('Password must be at least 8 characters and include a letter and a number'),
  body('role').isIn(ADMIN_ROLES).withMessage('Invalid role'),
];
const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
  body('role').optional().isIn(ADMIN_ROLES).withMessage('Invalid role'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
];

router.get('/', authenticate, authorizeSuperAdmin, ctrl.getAll);
router.post('/', authenticate, authorizeSuperAdmin, createRules, handleValidation, auditLog('admin.create'), ctrl.create);
router.put('/:id', authenticate, authorizeSuperAdmin, updateRules, handleValidation, auditLog('admin.update'), ctrl.update);
router.delete('/:id', authenticate, authorizeSuperAdmin, auditLog('admin.delete'), ctrl.remove);

module.exports = router;
