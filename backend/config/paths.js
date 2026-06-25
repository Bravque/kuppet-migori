const path = require('path');

// Root directory for all uploaded files (leader photos, news images, resource
// files, member documents, claim/scholarship attachments).
//
// On hosts that restore the working tree from git on every deploy (e.g. Hostinger
// GitHub auto-deploy), anything written under the deployed tree is WIPED on the
// next deploy — `public/uploads/` is git-ignored, so uploaded files vanish.
// Set UPLOAD_DIR to an ABSOLUTE path OUTSIDE the deployed tree (e.g. one level
// above public_html) so uploads persist across deploys.
//
// Falls back to public/uploads for local development when UPLOAD_DIR is unset.
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../public/uploads');

// Subdirectories created at startup and used by the multer instances.
const UPLOAD_SUBDIRS = ['photos', 'documents', 'bbf', 'scholarships', 'members', 'news'];

module.exports = { UPLOAD_ROOT, UPLOAD_SUBDIRS };
