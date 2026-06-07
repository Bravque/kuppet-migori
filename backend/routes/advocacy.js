const express = require('express');
const router = express.Router();
const { getAll, getOne } = require('../controllers/advocacyController');

router.get('/', getAll);
router.get('/:slug', getOne);

module.exports = router;
