const router = require('express').Router();
const { authenticateMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberScholarshipController');

router.get('/', authenticateMember, ctrl.getAvailable);
router.get('/applications', authenticateMember, ctrl.getApplications);
router.get('/applications/:id', authenticateMember, ctrl.getOneApplication);
router.post('/:id/apply', authenticateMember, upload.scholarshipDocs.array('files', 5), ctrl.apply);

module.exports = router;
