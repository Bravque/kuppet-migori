const express = require('express');
const router = express.Router();
const { getAll } = require('../controllers/scholarshipsController');

router.get('/', getAll);

module.exports = router;
