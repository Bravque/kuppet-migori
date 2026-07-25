const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { UPLOAD_ROOT } = require('../config/paths');

function storage(subdir) {
  return multer.diskStorage({
    destination: path.join(UPLOAD_ROOT, subdir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomUUID() + ext);
    },
  });
}

function fileFilter(allowedMimes) {
  return (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: ${allowedMimes.join(', ')}`));
    }
  };
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_MIMES   = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword',
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const PDF_IMG     = ['image/jpeg', 'image/png', 'application/pdf'];
// News articles accept images (gallery) + an optional downloadable document
const NEWS_MIMES  = [...new Set([...IMAGE_MIMES, ...DOC_MIMES])];

const MB = 1024 * 1024;

module.exports = {
  photo: multer({
    storage: storage('photos'),
    limits: { fileSize: 2 * MB },
    fileFilter: fileFilter(IMAGE_MIMES),
  }),

  document: multer({
    storage: storage('documents'),
    limits: { fileSize: 10 * MB },
    fileFilter: fileFilter(DOC_MIMES),
  }),

  bbfDocs: multer({
    storage: storage('bbf'),
    limits: { fileSize: 10 * MB },
    fileFilter: fileFilter(PDF_IMG),
  }),

  scholarshipDocs: multer({
    storage: storage('scholarships'),
    // 5 MB is ample for a scanned letter + TSC slip; the smaller cap sharply cuts
    // bandwidth/disk per application, which matters most during an application rush.
    limits: { fileSize: 5 * MB },
    fileFilter: fileFilter(PDF_IMG),
  }),

  // Court-case documents (pleadings, rulings, correspondence). Access-controlled
  // like the sensitive dirs; served only via /api/admin/documents/:filename.
  courtDocs: multer({
    storage: storage('court'),
    limits: { fileSize: 10 * MB },
    fileFilter: fileFilter(DOC_MIMES),
  }),

  // Disciplinary-case documents (query letters, interdiction letters, hearing
  // minutes, determinations). Access-controlled like court docs; served only
  // via /api/admin/documents/:filename.
  disciplinaryDocs: multer({
    storage: storage('disciplinary'),
    limits: { fileSize: 10 * MB },
    fileFilter: fileFilter(DOC_MIMES),
  }),

  memberDocs: multer({
    storage: storage('members'),
    limits: { fileSize: 5 * MB },
    fileFilter: fileFilter(PDF_IMG),
  }),

  // News article media — up to two gallery images + one downloadable document.
  // Stored in the public news/ dir (these are public notice-board articles).
  newsMedia: multer({
    storage: storage('news'),
    limits: { fileSize: 10 * MB },
    fileFilter: fileFilter(NEWS_MIMES),
  }),

  // Member profile/passport photo — images only (no PDF), stored in the
  // access-controlled members/ dir and served via /api/member/documents/.
  memberPhoto: multer({
    storage: storage('members'),
    limits: { fileSize: 2 * MB },
    fileFilter: fileFilter(IMAGE_MIMES),
  }),
};
