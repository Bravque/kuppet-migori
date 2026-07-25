const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticateMember } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberScholarshipController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
// Runs after multer, so req.body is populated for the multipart application form.
// Applicant identity is taken from the member's account (not the form). The
// application only requires the two documents (uploaded under the fixed field
// names below); the old study-detail text fields were removed 24 July 2026.
const applyRules = [];

const scholarshipUploads = upload.scholarshipDocs.fields([
  { name: 'letter_of_application', maxCount: 1 },
  { name: 'tsc_slip',              maxCount: 1 },
]);

router.get('/', authenticateMember, ctrl.getAvailable);
router.get('/applications', authenticateMember, ctrl.getApplications);
router.get('/applications/:id', authenticateMember, idParam, handleValidation, ctrl.getOneApplication);
router.post('/:id/apply', authenticateMember, scholarshipUploads, idParam, applyRules, handleValidation, ctrl.apply);
// Replace one required document on a still-pending ("applied") application.
router.post('/applications/:id/documents', authenticateMember, upload.scholarshipDocs.single('file'), idParam, handleValidation, ctrl.reuploadDocument);

module.exports = router;
