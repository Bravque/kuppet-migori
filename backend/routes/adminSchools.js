const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const ctrl = require('../controllers/schoolsController');

// Mounted at /api/admin/schools — so it's covered by the /api/admin CSRF gate.
const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
const nameRule = body('name').optional().trim().isLength({ max: 200 }).withMessage('School name too long');
const subCountyRule = body('sub_county').optional({ nullable: true }).trim().isLength({ max: 100 });

router.get('/', authenticate, authorizeAdmin, ctrl.adminGetAll);
router.post('/', authenticate, authorizeAdmin, nameRule, subCountyRule, handleValidation, auditLog('school.create'), ctrl.adminCreate);
router.put('/:id', authenticate, authorizeAdmin, idParam, nameRule, subCountyRule, handleValidation, auditLog('school.update'), ctrl.adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, idParam, handleValidation, auditLog('school.delete'), ctrl.adminRemove);

module.exports = router;
