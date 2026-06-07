const express = require('express');
const router = express.Router();
const { getAll, getUpcoming } = require('../controllers/eventsController');

router.get('/', getAll);
router.get('/upcoming', getUpcoming);

module.exports = router;
