const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { authenticateMember } = require('../middleware/auth');
const db = require('../config/database');

const UPLOAD_ROOT = path.join(__dirname, '../../public/uploads');

// Serve sensitive member documents only to the owning member
router.get('/:filename', authenticateMember, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // prevent path traversal

    // Verify the file belongs to this member
    const [[doc]] = await db.query(
      `SELECT 1 FROM bbf_claim_documents d
       JOIN bbf_claims c ON d.claim_id = c.id
       WHERE d.file_url LIKE ? AND c.member_id = ?
       UNION
       SELECT 1 FROM scholarship_application_documents d
       JOIN scholarship_applications a ON d.application_id = a.id
       WHERE d.file_url LIKE ? AND a.member_id = ?
       UNION
       SELECT 1 FROM members WHERE passport_photo_url LIKE ? AND id = ?
       UNION
       SELECT 1 FROM members WHERE national_id_url LIKE ? AND id = ?
       LIMIT 1`,
      [`%${filename}`, req.member.id, `%${filename}`, req.member.id,
       `%${filename}`, req.member.id, `%${filename}`, req.member.id]
    );

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Find file in one of the upload subdirs
    const subdirs = ['members', 'bbf', 'scholarships'];
    for (const sub of subdirs) {
      const filepath = path.join(UPLOAD_ROOT, sub, filename);
      if (fs.existsSync(filepath)) {
        return res.sendFile(filepath);
      }
    }
    res.status(404).json({ success: false, message: 'File not found on server' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to serve document' });
  }
});

module.exports = router;
