const router = require('express').Router();
const ctrl = require('../controllers/smsController');

// TalkSasa delivery webhook — called by TalkSasa, so it can't use JWT auth. Instead
// gate it with a shared secret (set SMS_WEBHOOK_SECRET and register the webhook URL as
// .../api/sms/webhook?token=<secret>). If the secret is unset the endpoint stays open
// (so an existing live setup isn't broken), but setting it is strongly recommended —
// otherwise anyone can POST falsified delivery statuses into sms_logs.
function verifyWebhookSecret(req, res, next) {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  if (!secret) return next(); // not configured — allow (log a warning once at boot elsewhere)
  const provided = req.query.token || req.headers['x-webhook-secret'];
  if (provided !== secret) {
    return res.status(401).json({ success: false, message: 'Invalid webhook token' });
  }
  next();
}

router.post('/', verifyWebhookSecret, ctrl.webhook);

module.exports = router;
