const router = require('express').Router();
const { authenticateMember } = require('../middleware/auth');
const ctrl = require('../controllers/memberNotifController');

router.get('/', authenticateMember, ctrl.getAll);
router.put('/read-all', authenticateMember, ctrl.markAllRead);
router.put('/:id/read', authenticateMember, ctrl.markRead);

module.exports = router;
