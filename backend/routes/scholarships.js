const express = require('express');
const router = express.Router();
const { getAll, adminCreate, adminUpdate, adminRemove } = require('../controllers/scholarshipsController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');

router.get('/', getAll);

router.post('/', authenticate, authorizeAdmin, auditLog('scholarships.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, auditLog('scholarships.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('scholarships.delete'), adminRemove);

module.exports = router;
