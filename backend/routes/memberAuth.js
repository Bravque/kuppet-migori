const router = require('express').Router();
const { body } = require('express-validator');
const { authenticateMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberAuthController');

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// Register (multer parses the multipart text fields; no document uploads at registration)
router.post('/register',
  upload.memberDocs.none(),
  [
    body('full_name').trim().notEmpty().withMessage('Full name required').isLength({ max: 200 }),
    body('tsc_number').trim().notEmpty().withMessage('TSC number required').isLength({ max: 50 }),
    body('national_id').trim().notEmpty().withMessage('National ID required').isLength({ max: 30 }),
    body('phone').trim().notEmpty().withMessage('Phone required').isLength({ max: 30 }),
    body('email').trim().isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
      .withMessage('Password must be at least 8 characters and include a letter and a number'),
    body('gender').isIn(['male','female','other']).withMessage('Gender required'),
    body('date_of_birth').isDate().withMessage('Valid date of birth required'),
    body('school_name').trim().notEmpty().withMessage('School name required').isLength({ max: 300 }),
    body('sub_county').trim().notEmpty().withMessage('Sub-county required').isLength({ max: 150 }),
    body('school_category').isIn(['senior_school','junior_school','tertiary_school']).withMessage('Category (senior, junior or tertiary school) required'),
    body('job_group').isIn(['B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5']).withMessage('Job group required'),
  ],
  validate,
  ctrl.register
);

// Login
router.post('/login',
  [
    // Identifier is the TSC number (validated in the controller, which also
    // accepts the legacy `email` key from any cached older client).
    body('password').notEmpty(),
  ],
  validate,
  ctrl.login
);

// Forgot / reset password
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token required'),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
      .withMessage('Password must be at least 8 characters and include a letter and a number'),
  ],
  validate,
  ctrl.resetPassword
);

// Protected routes
router.get('/me', authenticateMember, ctrl.getMe);

// First-login forced password change (imported members on the default ID password)
router.post('/first-password', authenticateMember,
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .withMessage('Password must be at least 8 characters and include a letter and a number'),
  validate,
  ctrl.firstPassword
);
router.put('/password', authenticateMember,
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .withMessage('Password must be at least 8 characters and include a letter and a number'),
  validate,
  ctrl.changePassword
);

module.exports = router;
