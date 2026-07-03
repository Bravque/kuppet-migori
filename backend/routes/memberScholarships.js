const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticateMember } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberScholarshipController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
// Runs after multer, so req.body is populated for the multipart application form.
// Applicant identity is taken from the member's account (not the form); the two
// required documents are uploaded under fixed field names below.
const applyRules = [
  body('institution').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('course').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('year_of_study').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('academic_year').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('essay').optional({ nullable: true }).trim().isLength({ max: 20000 }),
];

const scholarshipUploads = upload.scholarshipDocs.fields([
  { name: 'letter_of_application', maxCount: 1 },
  { name: 'tsc_slip',              maxCount: 1 },
]);

router.get('/', authenticateMember, ctrl.getAvailable);
router.get('/applications', authenticateMember, ctrl.getApplications);
router.get('/applications/:id', authenticateMember, idParam, handleValidation, ctrl.getOneApplication);
router.post('/:id/apply', authenticateMember, scholarshipUploads, idParam, applyRules, handleValidation, ctrl.apply);

module.exports = router;
