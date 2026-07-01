const router = require('express').Router();
const { param } = require('express-validator');
const { authenticateMember } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/memberNotifController');

router.get('/', authenticateMember, ctrl.getAll);
router.put('/read-all', authenticateMember, ctrl.markAllRead);
router.put('/:id/read', authenticateMember, param('id').isInt({ min: 1 }).withMessage('Invalid id'), handleValidation, ctrl.markRead);

module.exports = router;
