const router = require('express').Router();
const { param, body } = require('express-validator');
const { authenticateMember } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/memberBbfController');

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id');
// The controller pulls the member's own identity from their profile and enforces the
// death-claim required fields; these rules just bound/shape the free-text inputs.
const createRules = [
  body('claim_type').isIn(['death', 'retirement']).withMessage('Claim type must be death or retirement'),
  body('deceased_name').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('relationship').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('date_of_death').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('date_of_death must be a valid date'),
];

router.get('/', authenticateMember, ctrl.getAll);
router.post('/', authenticateMember, createRules, handleValidation, ctrl.create);
router.get('/:id', authenticateMember, idParam, handleValidation, ctrl.getOne);
router.post('/:id/submit', authenticateMember, idParam, handleValidation, ctrl.submitClaim);
router.post('/:id/documents', authenticateMember, upload.bbfDocs.array('files', 5), idParam, handleValidation, ctrl.uploadDocuments);
router.get('/:id/timeline', authenticateMember, idParam, handleValidation, ctrl.getTimeline);

module.exports = router;
