const rateLimit = require('express-rate-limit');

// Brute-force protection on login/register — tighter than the AI limiter
// since credential-guessing is cheap per-request (no external API cost).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again later.' },
});

// Every AI-backed route calls the Gemini API, which costs real money per
// request — this caps abuse/runaway-loop cost, not just brute force.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many AI requests. Try again later.' },
});

// Not an AI call, but each request writes a file to disk — caps how fast
// storage can be filled, separate from the auth/AI concerns above.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many uploads. Try again later.' },
});

module.exports = { authLimiter, aiLimiter, uploadLimiter };
