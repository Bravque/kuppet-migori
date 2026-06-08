const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '../../public/uploads');

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
    limits: { fileSize: 10 * MB },
    fileFilter: fileFilter(PDF_IMG),
  }),

  memberDocs: multer({
    storage: storage('members'),
    limits: { fileSize: 5 * MB },
    fileFilter: fileFilter(PDF_IMG),
  }),
};
