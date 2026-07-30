const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Declared Content-Type is trivially spoofable, so this is only a cheap
// first-pass filter — memoryStorage (not diskStorage) is deliberate here so
// the real check (magic bytes via file-type, see noteController.uploadImage)
// can run against the actual buffered bytes once the upload completes.
// SVG is excluded from the allowlist entirely — it can carry inline
// <script>, which a magic-byte check wouldn't catch anyway since SVG is text.
const ALLOWED_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_MIMETYPES.has(file.mimetype));
  },
});

module.exports = upload;
