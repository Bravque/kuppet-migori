const express = require('express');
const router = express.Router();
const { getAll, getUpcoming, adminCreate, adminUpdate, adminRemove } = require('../controllers/eventsController');
const { authenticate, authorizeAdmin, auditLog } = require('../middleware/auth');

router.get('/', getAll);
router.get('/upcoming', getUpcoming);

router.post('/', authenticate, authorizeAdmin, auditLog('events.create'), adminCreate);
router.put('/:id', authenticate, authorizeAdmin, auditLog('events.update'), adminUpdate);
router.delete('/:id', authenticate, authorizeAdmin, auditLog('events.delete'), adminRemove);

module.exports = router;
