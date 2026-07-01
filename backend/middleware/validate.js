const { validationResult } = require('express-validator');

// Runs after a route's express-validator chain: if any rule failed, respond 400 with the
// list of errors; otherwise continue. Place it right after the body()/param() validators
// (and after multer, for multipart routes, so req.body is populated).
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { handleValidation };
