/**
 * Resolves the uploads directory in every environment.
 *
 * - Vercel: the deployment filesystem is read-only, so files are written
 *   to /tmp/uploads (ephemeral per instance).
 * - Everywhere else (local, Render, Docker): the repo-level uploads/
 *   directory keeps existing behavior unchanged.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

function getUploadsBaseDir() {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'uploads');
  }
  return path.join(__dirname, '../../uploads');
}

function ensureUploadsDir(subdir = '') {
  const dir = subdir ? path.join(getUploadsBaseDir(), subdir) : getUploadsBaseDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = {
  getUploadsBaseDir,
  ensureUploadsDir
};
