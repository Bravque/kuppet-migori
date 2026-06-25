const express = require('express');
const router = express.Router();
const { getAll, getOne, getFeatured, adminCreate, adminUpdate, adminRemove, adminGetAll, adminGetOne } = require('../controllers/newsController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Two gallery images + one downloadable document per article
const newsUpload = upload.newsMedia.fields([
  { name: 'image1',   maxCount: 1 },
  { name: 'image2',   maxCount: 1 },
  { name: 'document', maxCount: 1 },
]);

// Public
router.get('/featured', getFeatured);
router.get('/', getAll);

// Admin (declared before '/:slug' so 'admin' isn't swallowed as a slug)
router.get('/admin/all', authenticate, authorizeAdmin, adminGetAll);
router.get('/admin/:id', authenticate, authorizeAdmin, adminGetOne);
router.post('/', authenticate, authorizeAdmin, newsUpload, auditLog('news.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, newsUpload, auditLog('news.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('news.delete'), adminRemove);

// Public single article (slug) — last, so it doesn't catch the admin routes
router.get('/:slug', getOne);

module.exports = router;
