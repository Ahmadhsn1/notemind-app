const express = require('express');
const router = express.Router();
const { getSharedNote } = require('../controllers/publicNoteController');
const { publicShareLimiter } = require('../middleware/rateLimit');

// Mounted at /api/public/notes in app.js — deliberately its own router
// rather than a route inside noteRoutes.js, so it can never end up behind
// `protect` by accident. No `protect` here at all, ever: this is the app's
// one intentionally-unauthenticated data route.
router.get('/:token', publicShareLimiter, getSharedNote);

module.exports = router;
