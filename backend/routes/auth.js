const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// Admin login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  ctrl.adminLogin
);

// Confirm TOTP after login (exchange temp token for full JWT)
router.post('/2fa/confirm',
  body('tempToken').notEmpty(),
  body('totp').notEmpty(),
  validate,
  ctrl.confirmTotp
);

// Get current admin user
router.get('/me', authenticate, ctrl.getMe);

// Change password
router.put('/password', authenticate,
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .withMessage('Password must be at least 8 characters and include a letter and a number'),
  validate,
  ctrl.changePassword
);

// 2FA setup (generates secret + QR code — does not enable until /2fa/enable)
router.post('/2fa/setup', authenticate, auditLog('auth.2fa_setup'), ctrl.setup2FA);

// Enable 2FA (verify first TOTP code)
router.post('/2fa/enable', authenticate,
  body('totp').notEmpty(),
  validate,
  ctrl.enable2FA
);

// Disable 2FA (super_admin only)
router.delete('/2fa/disable', authenticate, authorizeSuperAdmin, auditLog('auth.2fa_disable'), ctrl.disable2FA);

module.exports = router;
