const router = require('express').Router();
const ctrl = require('../controllers/smsController');

router.post('/', ctrl.webhook);

module.exports = router;
