const express = require('express');
const router = express.Router();
const { getAll, getOne, getFeatured, adminCreate, adminUpdate, adminRemove, adminGetAll } = require('../controllers/newsController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');

// Public
router.get('/featured', getFeatured);
router.get('/', getAll);
router.get('/:slug', getOne);

// Admin
router.get('/admin/all', authenticate, authorizeAdmin, adminGetAll);
router.post('/', authenticate, authorizeAdmin, auditLog('news.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, auditLog('news.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('news.delete'), adminRemove);

module.exports = router;
