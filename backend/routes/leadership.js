const express = require('express');
const router = express.Router();
const { getAll, adminCreate, adminUpdate, adminRemove } = require('../controllers/leadershipController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getAll);

router.post('/', authenticate, authorizeAdmin, upload.photo.single('photo'), auditLog('leadership.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, upload.photo.single('photo'), auditLog('leadership.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('leadership.delete'), adminRemove);

module.exports = router;
