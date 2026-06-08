const router = require('express').Router();
const { authenticateMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberBbfController');

router.get('/', authenticateMember, ctrl.getAll);
router.post('/', authenticateMember, ctrl.create);
router.get('/:id', authenticateMember, ctrl.getOne);
router.post('/:id/submit', authenticateMember, ctrl.submitClaim);
router.post('/:id/documents', authenticateMember, upload.bbfDocs.array('files', 5), ctrl.uploadDocuments);
router.get('/:id/timeline', authenticateMember, ctrl.getTimeline);

module.exports = router;
