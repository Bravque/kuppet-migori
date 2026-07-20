const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, download, adminCreate, adminUpdate, adminRemove, adminGetAll } = require('../controllers/resourcesController');
const { authenticate, authorizeContent, auditLog } = require('../middleware/auth');
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
// Admin listing (all statuses incl. drafts) — declared before '/:id/download'.
router.get('/admin/all', authenticate, authorizeContent, adminGetAll);
router.get('/:id/download', download);

router.post('/', authenticate, authorizeContent, upload.document.single('file'), resourceRules, handleValidation, auditLog('resources.create'), adminCreate);
router.put('/:id', authenticate, authorizeContent, upload.document.single('file'), resourceRules, handleValidation, auditLog('resources.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeContent, auditLog('resources.delete'), adminRemove);

module.exports = router;
