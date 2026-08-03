const mongoose = require('mongoose');
const multer = require('multer');
const HttpError = require('../utils/HttpError');

const notFoundHandler = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

// body-parser attaches a `type` and a 4xx `status` to the errors it throws.
// Mapped to fixed messages rather than passing err.message through, since
// the raw message for a parse failure quotes the offending payload back.
const BODY_PARSER_MESSAGES = {
  'entity.parse.failed': 'Malformed JSON in request body',
  'entity.too.large': 'Request body is too large',
  'encoding.unsupported': 'Unsupported content encoding',
  'request.aborted': 'Request aborted',
};

// Express 5 forwards rejected promises from async route handlers here
// automatically — controllers no longer need their own try/catch just to
// map errors to a response. HttpError carries an intentional status/message;
// everything below it is a *client* mistake that used to fall through to a
// generic 500 (an invalid ObjectId in a :id param being by far the most
// common — every scanner and every typo'd link produced a fake server error).
// Anything genuinely unexpected is still logged server-side and reported as a
// bare 500, never error.message, which can leak internals.
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

  // A malformed :id param (`GET /api/notes/abc`) reaches Mongoose as a
  // CastError. Only the path is echoed back, never err.value — that's raw
  // client input and echoing it invites reflection tricks in error surfaces.
  if (err instanceof mongoose.Error.CastError) {
    const field = err.path === '_id' ? 'id' : err.path;
    return res.status(400).json({ message: `Invalid ${field}` });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = {};
    for (const [field, issue] of Object.entries(err.errors || {})) {
      errors[field] = issue.message;
    }
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  // Duplicate key against a unique index. The only one in the app is
  // User.email, which registerUser/updateProfile check for first — this is
  // the race between that check and the write, not a normal path.
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'That value is already in use' });
  }

  if (err?.type && BODY_PARSER_MESSAGES[err.type]) {
    return res.status(err.status || 400).json({ message: BODY_PARSER_MESSAGES[err.type] });
  }

  // Deliberately not `console.error(err)` — a raw Mongoose error object
  // embeds the offending document, which for this app means note content and
  // emails in plaintext logs. Replaced wholesale by structured logging later.
  console.error(`[error] ${req.method} ${req.originalUrl} —`, err?.stack || err?.message || err);
  res.status(500).json({ message: 'Server error' });
};

module.exports = { notFoundHandler, errorHandler };
