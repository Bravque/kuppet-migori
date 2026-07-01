const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getAll, getOne, getFeatured, adminCreate, adminUpdate, adminRemove, adminGetAll, adminGetOne } = require('../controllers/newsController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');

// Two gallery images + one downloadable document per article
const newsUpload = upload.newsMedia.fields([
  { name: 'image1',   maxCount: 1 },
  { name: 'image2',   maxCount: 1 },
  { name: 'document', maxCount: 1 },
]);

const NEWS_CATEGORIES = ['news', 'announcement', 'circular', 'press_release', 'event', 'sport_entertainment'];
// Runs after multer, so req.body is populated for the multipart form. Fields are
// optional() on update; the controller enforces title+content presence on create.
const newsRules = [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be 1–300 characters'),
  body('excerpt').optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage('Excerpt too long (max 1000)'),
  body('content').optional().trim().isLength({ min: 1, max: 50000 }).withMessage('Content must be 1–50000 characters'),
  body('category').optional().isIn(NEWS_CATEGORIES).withMessage('Invalid category'),
  body('author').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('tags').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

// Public
router.get('/featured', getFeatured);
router.get('/', getAll);

// Admin (declared before '/:slug' so 'admin' isn't swallowed as a slug)
router.get('/admin/all', authenticate, authorizeAdmin, adminGetAll);
router.get('/admin/:id', authenticate, authorizeAdmin, adminGetOne);
router.post('/', authenticate, authorizeAdmin, newsUpload, newsRules, handleValidation, auditLog('news.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, newsUpload, newsRules, handleValidation, auditLog('news.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('news.delete'), adminRemove);

// Public single article (slug) — last, so it doesn't catch the admin routes
router.get('/:slug', getOne);

module.exports = router;
