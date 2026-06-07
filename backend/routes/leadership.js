const express = require('express');
const router = express.Router();
const { getAll } = require('../controllers/leadershipController');

router.get('/', getAll);

module.exports = router;
