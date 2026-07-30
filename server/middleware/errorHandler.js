const multer = require('multer');
const HttpError = require('../utils/HttpError');

const notFoundHandler = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

// Express 5 forwards rejected promises from async route handlers here
// automatically — controllers no longer need their own try/catch just to
// map errors to a response. HttpError carries an intentional status/message;
// anything else is an unexpected failure, logged server-side but reported to
// the client as a generic 500 (never error.message, which can leak internals
// like stack traces or DB details).
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  // MulterError (e.g. LIMIT_FILE_SIZE) is an expected, user-facing validation
  // failure just like HttpError, not an unexpected server fault — report its
  // message (multer's own messages are generic enough not to leak internals)
  // instead of falling through to a bare 500.
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: 'Server error' });
};

module.exports = { notFoundHandler, errorHandler };
