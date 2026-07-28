const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { UPLOAD_ROOT } = require('../config/paths');

// The uploader controls the original filename, and path.extname() returns
// everything after the last dot — including quotes and other syntax characters
// (`x.pdf'-alert(1)-'` yields `.pdf'-alert(1)-'`). That extension ends up in the
// stored file_url, so anything rendered from it inherits whatever the uploader
// put there. Accept only a plain alphanumeric extension and otherwise store the
// file without one; the type is enforced by fileFilter on the MIME type anyway.
// (Traversal was never possible here — extname returns '' when the last path
// segment has no dot — but the quotes were enough to break out of a JS string.)
function safeExtension(originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

function storage(subdir) {
  return multer.diskStorage({
    destination: path.join(UPLOAD_ROOT, subdir),
    filename: (_req, file, cb) => {
      cb(null, crypto.randomUUID() + safeExtension(file.originalname));
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
