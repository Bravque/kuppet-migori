const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, download, adminCreate, adminUpdate, adminRemove } = require('../controllers/resourcesController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');

const RESOURCE_CATEGORIES = ['curriculum', 'circular', 'moe_document', 'tsc_resource', 'professional_dev', 'teaching_material', 'legal', 'policy', 'sport_entertainment'];
// Runs after multer (file upload), so req.body is populated.
const resourceRules = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be 1–300 characters'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 20000 }),
  body('category').optional().isIn(RESOURCE_CATEGORIES).withMessage('Invalid category'),
  body('subject').optional({ nullable: true }).trim().isLength({ max: 150 }),
  body('grade_level').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('external_url').optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage('External URL must be a URL'),
];

router.get('/', getAll);
router.get('/:id/download', download);

router.post('/', authenticate, authorizeAdmin, upload.document.single('file'), resourceRules, handleValidation, auditLog('resources.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, upload.document.single('file'), resourceRules, handleValidation, auditLog('resources.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('resources.delete'), adminRemove);

module.exports = router;
