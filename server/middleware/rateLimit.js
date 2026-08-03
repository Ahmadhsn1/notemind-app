const rateLimit = require('express-rate-limit');
const MongoRateLimitStore = require('../services/rateLimitStore');

// Counts live in MongoDB rather than express-rate-limit's default in-memory
// store. The memory store had two failure modes that combined into "no
// protection at all":
//   - it reset on every restart/deploy, so brute-force protection was
//     defeated by anyone willing to wait out (or trigger) a redeploy; and
//   - with more than one instance behind a load balancer, each kept its own
//     counter, multiplying every limit by the instance count.
// Mongo is already a hard dependency, so this needs no new service.
const WINDOW_MS = 15 * 60 * 1000;

// Each limiter gets its own key namespace so they don't share a bucket for
// the same IP.
const build = (prefix, limit, message) => rateLimit({
  windowMs: WINDOW_MS,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
  store: new MongoRateLimitStore(prefix),
});

// Brute-force protection on login/register — tighter than the AI limiter
// since credential-guessing is cheap per-request (no external API cost).
const authLimiter = build('auth', 20, 'Too many attempts. Try again later.');

// Every AI-backed route calls the Gemini API, which costs real money per
// request. This caps burst rate per IP; middleware/aiQuota.js caps daily
// spend per account. Both are applied — neither substitutes for the other.
const aiLimiter = build('ai', 60, 'Too many AI requests. Try again later.');

// Not an AI call, but each request writes a file to storage — caps how fast
// storage can be filled, separate from the auth/AI concerns above.
const uploadLimiter = build('upload', 30, 'Too many uploads. Try again later.');

// Backstop over the whole API. Note CRUD, the admin surface, flashcards,
// notifications and — worst — the export endpoints previously had no limit at
// all; exportNotesMarkdown zips every note at zlib level 9, so one
// authenticated account looping it could pin the CPU indefinitely.
const globalLimiter = build('global', 1000, 'Too many requests. Slow down.');

// Exports stream a full archive of every note. Far more expensive per call
// than anything else in the app, and nobody legitimately needs many per hour.
const exportLimiter = build('export', 10, 'Too many export requests. Try again later.');

// Static config mirror for the admin System tab — express-rate-limit doesn't
// expose a stable public API to read a limiter's own config back out.
const rateLimitConfig = {
  auth: { windowMs: WINDOW_MS, limit: 20, scope: 'login/register' },
  ai: { windowMs: WINDOW_MS, limit: 60, scope: 'AI-backed routes' },
  upload: { windowMs: WINDOW_MS, limit: 30, scope: 'image uploads' },
  global: { windowMs: WINDOW_MS, limit: 1000, scope: 'all API routes' },
  export: { windowMs: WINDOW_MS, limit: 10, scope: 'data exports' },
};

module.exports = { authLimiter, aiLimiter, uploadLimiter, globalLimiter, exportLimiter, rateLimitConfig };
