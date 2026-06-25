const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const db = require('../config/database');
const { UPLOAD_ROOT } = require('../config/paths');

const SUBDIRS = ['members', 'bbf', 'scholarships'];

// Serve sensitive member/claim/scholarship documents to authenticated admins.
// Mirrors the member-side ownership gate, but admins may view any member's file.
// The filename must correspond to a real stored document (no arbitrary reads).
router.get('/:filename', authenticate, authorizeAdmin, async (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal

  // Confirm the filename belongs to a known document/PII record before serving.
  const [[doc]] = await db.query(
    `SELECT 1 FROM bbf_claim_documents WHERE file_url LIKE ?
     UNION SELECT 1 FROM scholarship_application_documents WHERE file_url LIKE ?
     UNION SELECT 1 FROM members WHERE passport_photo_url LIKE ?
     UNION SELECT 1 FROM members WHERE national_id_url LIKE ?
     LIMIT 1`,
    [`%${filename}`, `%${filename}`, `%${filename}`, `%${filename}`]
  );
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  for (const sub of SUBDIRS) {
    const filepath = path.join(UPLOAD_ROOT, sub, filename);
    if (fs.existsSync(filepath)) return res.sendFile(filepath);
  }
  res.status(404).json({ success: false, message: 'File not found on server' });
});

module.exports = router;
