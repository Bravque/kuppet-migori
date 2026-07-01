const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticateMember } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberScholarshipController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
// Runs after multer, so req.body is populated for the multipart application form.
const applyRules = [
  body('applicant_name').trim().notEmpty().withMessage('Applicant name required').isLength({ max: 200 }),
  body('institution').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('course').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('year_of_study').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('academic_year').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('essay').optional({ nullable: true }).trim().isLength({ max: 20000 }),
];

router.get('/', authenticateMember, ctrl.getAvailable);
router.get('/applications', authenticateMember, ctrl.getApplications);
router.get('/applications/:id', authenticateMember, idParam, handleValidation, ctrl.getOneApplication);
router.post('/:id/apply', authenticateMember, upload.scholarshipDocs.array('files', 5), idParam, applyRules, handleValidation, ctrl.apply);

module.exports = router;
