const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimit');
const { resurfaceReplySchema } = require('../validators/resurfaceValidators');
const {
  getTodaysResurface,
  markResurfaceViewed,
  submitResurfaceReply,
  getResurfaceStreak,
} = require('../controllers/resurfaceController');

// aiLimiter here since the first call of the day may spend a Gemini call
// (the reflection generation) — same convention as /notes/digest.
router.get('/today', protect, aiLimiter, getTodaysResurface);
router.patch('/today/viewed', protect, markResurfaceViewed);
router.post('/today/reply', protect, validateBody(resurfaceReplySchema), submitResurfaceReply);
router.get('/streak', protect, getResurfaceStreak);

module.exports = router;
