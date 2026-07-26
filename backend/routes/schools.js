const router = require('express').Router();
const ctrl = require('../controllers/schoolsController');

// Public — autocomplete source for the school-name field (no auth; the
// registration form is public). Optional ?q= narrows the list.
router.get('/', ctrl.getPublic);

module.exports = router;
