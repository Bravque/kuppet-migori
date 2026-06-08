const express = require('express');
const router = express.Router();
const { getAll, download, adminCreate, adminUpdate, adminRemove } = require('../controllers/resourcesController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getAll);
router.get('/:id/download', download);

router.post('/', authenticate, authorizeAdmin, upload.document.single('file'), auditLog('resources.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, upload.document.single('file'), auditLog('resources.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('resources.delete'), adminRemove);

module.exports = router;
