const router = require('express').Router();
const { authenticateMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberProfileController');

router.get('/', authenticateMember, ctrl.getProfile);
router.put('/', authenticateMember, ctrl.updateProfile);
router.post('/photo', authenticateMember, upload.memberDocs.single('photo'), ctrl.uploadPhoto);

module.exports = router;
