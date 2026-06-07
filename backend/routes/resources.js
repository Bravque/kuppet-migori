const express = require('express');
const router = express.Router();
const { getAll, download } = require('../controllers/resourcesController');

router.get('/', getAll);
router.get('/:id/download', download);

module.exports = router;
