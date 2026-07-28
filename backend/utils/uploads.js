const fs = require('fs/promises');
const path = require('path');
const { UPLOAD_ROOT } = require('../config/paths');

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

// Delete a file that is already recorded in the DB, given the stored URL path
// (`/uploads/<subdir>/<name>`). Used when a stored document is superseded, so
// the replaced file doesn't linger on the upload dir forever.
//
// Only ever call this once the DB no longer references the file. Best-effort:
// a failed unlink is logged, never thrown — the row is already gone, and
// reporting a failure would wrongly invite the caller to retry.
async function removeStoredFile(fileUrl) {
  const m = /^\/uploads\/([^/]+)\/(.+)$/.exec(fileUrl || '');
  if (!m) return;
  // basename both segments: these come from our own DB, but a stored value must
  // never be able to walk out of the upload root.
  const target = path.join(UPLOAD_ROOT, path.basename(m[1]), path.basename(m[2]));
  try {
    await fs.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[uploads] could not remove replaced file', target, '-', err.message);
  }
}

module.exports = { removeUploadedFiles, removeStoredFile };
