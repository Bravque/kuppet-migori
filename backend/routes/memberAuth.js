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

// Register (multer processes files before controller)
router.post('/register',
  upload.memberDocs.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'national_id_scan', maxCount: 1 },
  ]),
  [
    body('full_name').trim().notEmpty().withMessage('Full name required').isLength({ max: 200 }),
    body('tsc_number').trim().notEmpty().withMessage('TSC number required').isLength({ max: 50 }),
    body('national_id').trim().notEmpty().withMessage('National ID required').isLength({ max: 30 }),
    body('phone').trim().notEmpty().withMessage('Phone required').isLength({ max: 30 }),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('gender').isIn(['male','female','other']).withMessage('Gender required'),
    body('date_of_birth').isDate().withMessage('Valid date of birth required'),
    body('school_name').trim().notEmpty().withMessage('School name required').isLength({ max: 300 }),
    body('sub_county').trim().notEmpty().withMessage('Sub-county required').isLength({ max: 150 }),
    body('school_category').isIn(['senior_school','junior_school']).withMessage('Category (senior or junior school) required'),
  ],
  validate,
  ctrl.register
);

// Login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  ctrl.login
);

// Protected routes
router.get('/me', authenticateMember, ctrl.getMe);
router.put('/password', authenticateMember,
  body('newPassword').isLength({ min: 8 }).withMessage('Minimum 8 characters'),
  validate,
  ctrl.changePassword
);

module.exports = router;
