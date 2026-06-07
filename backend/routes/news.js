const express = require('express');
const router = express.Router();
const { getAll, getOne, getFeatured } = require('../controllers/newsController');

router.get('/', getAll);
router.get('/featured', getFeatured);
router.get('/:slug', getOne);

module.exports = router;
