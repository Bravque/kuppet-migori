const fs = require('fs/promises');

// Multer (diskStorage) writes every accepted file before the route handler runs,
// and cleans up after itself only when *it* is the one that fails (size limit,
// rejected type). Anything that rejects the request afterwards — a failed
// validator, an ownership check, a DB error — leaves those files on disk with no
// row referencing them. Uploads live on the persistent UPLOAD_DIR outside the
// deploy tree, so orphans accumulate there indefinitely.
//
// Call this on every path that responds without recording the upload. It is
// best-effort by design: cleanup must never mask the error being returned.
async function removeUploadedFiles(req) {
  const files = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
    : (req.file ? [req.file] : []);

  await Promise.all(files.map(async (f) => {
    if (!f || !f.path) return;
    try {
      await fs.unlink(f.path);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[uploads] could not remove orphan', f.path, '-', err.message);
    }
  }));
}

module.exports = { removeUploadedFiles };
