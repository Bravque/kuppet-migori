const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/adminSchAppController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const notes = body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 });

router.get('/', authenticate, authorizeAdmin, ctrl.getAll);
router.get('/:id', authenticate, authorizeAdmin, idParam, handleValidation, ctrl.getOne);
router.put('/:id/approve', authenticate, authorizeSuperAdmin, idParam, notes, handleValidation, auditLog('schapp.approve'), ctrl.approve);
router.put('/:id/reject', authenticate, authorizeAdmin, idParam, notes, handleValidation, auditLog('schapp.reject'), ctrl.reject);

module.exports = router;
