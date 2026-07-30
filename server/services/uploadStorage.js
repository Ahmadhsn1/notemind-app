const fs = require('fs');
const path = require('path');

// Local-disk implementation only — isolated behind this thin interface so a
// later S3 (or similar) swap only touches this one file, not the upload
// middleware/route/orphan-cleanup code that calls into it.
const uploadsDir = path.join(__dirname, '..', 'uploads');

// multer's diskStorage needs the destination directory to exist up front;
// git doesn't track empty directories, so this can't just rely on a
// checked-in folder existing on a fresh clone.
fs.mkdirSync(uploadsDir, { recursive: true });

const urlFor = (filename) => `/uploads/${filename}`;

module.exports = { uploadsDir, urlFor };
