const express = require('express');
const router = express.Router();
const { getAll, getOne, adminCreate, adminUpdate, adminRemove } = require('../controllers/advocacyController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');

router.get('/', getAll);
router.get('/:slug', getOne);

router.post('/', authenticate, authorizeAdmin, auditLog('advocacy.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, auditLog('advocacy.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('advocacy.delete'), adminRemove);

module.exports = router;
